
import * as echarts from 'echarts';

// State
let analyticsState = {
    filters: {
        year: 'all',
        month: 'all',
        category: 'all', // Product category ID
        status: 'all',   // Order status
        day: 'all'       // Day of week (0-6)
    },
    orders: [],
    products: [],
    categories: [],
    charts: {
        ordersOverTime: null,
        salesOverTime: null,
        salesByCategory: null
    }
};

// DOM Elements
let elements = {
    totalOrders: null,
    totalSales: null,
    avgTicket: null,
    mostSoldProduct: null,
    totalDelivery: null,
    mostUsedPaymentDisplay: null,
    filterYear: null,
    filterMonth: null,
    filterCategory: null,
    filterStatus: null,
    filterDay: null,
    chartOrders: null,
    chartSales: null,
    chartCategory: null
};

export const initAnalytics = (initialOrders, products = [], categories = []) => {
    cacheElements();
    initCharts();

    analyticsState.orders = initialOrders;
    analyticsState.products = products;
    analyticsState.categories = categories;

    setupFilters();
    updateAnalytics(analyticsState.orders);

    window.addEventListener('resize', () => {
        analyticsState.charts.ordersOverTime?.resize();
        analyticsState.charts.salesOverTime?.resize();
        analyticsState.charts.salesByCategory?.resize();
    });
};

export const updateAnalytics = (orders) => {
    if (orders !== analyticsState.orders) {
        analyticsState.orders = orders;
    }

    // 1. Filter Orders first (Date, Status)
    // AND Category (Keep order if it has at least one item of category)
    const filteredOrders = filterOrders(analyticsState.orders);

    // 2. Calculate Strict Metrics based on filtered orders AND active category filter
    // If Category is ALL: Sales = Sum(Order Total)
    // If Category is X: Sales = Sum(Items of Category X in those orders)
    updateKPICards(filteredOrders);

    // 3. Update Charts
    updateCharts(filteredOrders);
};

// ==========================================
// INTERNAL FUNCTIONS
// ==========================================

const cacheElements = () => {
    elements.totalOrders = document.getElementById('bi-total-orders');
    elements.totalSales = document.getElementById('bi-total-sales');
    elements.avgTicket = document.getElementById('bi-avg-ticket');
    elements.mostSoldProduct = document.getElementById('bi-most-sold-product');
    elements.totalDelivery = document.getElementById('bi-total-delivery');
    elements.mostUsedPaymentDisplay = document.getElementById('bi-payment-method');

    elements.filterYear = document.getElementById('bi-filter-year');
    elements.filterMonth = document.getElementById('bi-filter-month');
    elements.filterCategory = document.getElementById('bi-filter-category');
    elements.filterStatus = document.getElementById('bi-filter-status');
    elements.filterDay = document.getElementById('bi-filter-day');

    elements.chartOrders = document.getElementById('bi-chart-orders');
    elements.chartSales = document.getElementById('bi-chart-sales');
    elements.chartCategory = document.getElementById('bi-chart-category');
};

const initCharts = () => {
    if (elements.chartOrders) elements.chartOrders = echarts.init(document.getElementById('bi-chart-orders'));
    if (elements.chartSales) elements.chartSales = echarts.init(document.getElementById('bi-chart-sales'));
    if (elements.chartCategory) elements.chartCategory = echarts.init(document.getElementById('bi-chart-category'));

    // Fix: previous code might have assigned to state directly. Let's ensure state references are set.
    analyticsState.charts.ordersOverTime = elements.chartOrders;
    analyticsState.charts.salesOverTime = elements.chartSales;
    analyticsState.charts.salesByCategory = elements.chartCategory;
};

const setupFilters = () => {
    const validFilters = ['year', 'month', 'category', 'status', 'day'];

    validFilters.forEach(key => {
        const keyUpper = key.charAt(0).toUpperCase() + key.slice(1);
        const el = elements[`filter${keyUpper}`];
        if (el) {
            el.onchange = (e) => {
                analyticsState.filters[key] = e.target.value;
                updateAnalytics(analyticsState.orders);
            };
        }
    });

    populateDynamicFilters();
};

const populateDynamicFilters = () => {
    if (!analyticsState.orders.length) return;

    // Years
    const years = [...new Set(analyticsState.orders.map(o => new Date(o.created_at).getFullYear()))].sort((a, b) => b - a);
    if (elements.filterYear) {
        const currentVal = elements.filterYear.value;
        elements.filterYear.innerHTML = '<option value="all">Todo el tiempo</option>';
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            elements.filterYear.appendChild(opt);
        });
        elements.filterYear.value = currentVal;
    }

    // Categories
    if (elements.filterCategory && analyticsState.categories.length > 0) {
        const currentVal = elements.filterCategory.value;
        elements.filterCategory.innerHTML = '<option value="all">Todas las categorías</option>';
        analyticsState.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            elements.filterCategory.appendChild(opt);
        });
        elements.filterCategory.value = currentVal;
    }
};

const filterOrders = (orders) => {
    return orders.filter(order => {
        const date = new Date(order.created_at);
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString();
        const day = date.getDay().toString();

        if (analyticsState.filters.year !== 'all' && year !== analyticsState.filters.year) return false;
        if (analyticsState.filters.month !== 'all' && month !== analyticsState.filters.month) return false;
        if (analyticsState.filters.day !== 'all' && day !== analyticsState.filters.day) return false;
        if (analyticsState.filters.status !== 'all' && order.status !== analyticsState.filters.status) return false;

        // Category Filter (Order Retention)
        if (analyticsState.filters.category !== 'all') {
            const hasCategory = order.order_items?.some(item => {
                const product = analyticsState.products.find(p => String(p.id) === String(item.product_id));
                return product && String(product.category_id) === String(analyticsState.filters.category);
            });
            if (!hasCategory) return false;
        }

        return true;
    });
};

// Helper to calculate total value of an order (or partial order if filtering)
const getOrderValueForMetrics = (order) => {
    // If no Category Filter, return full Total
    if (analyticsState.filters.category === 'all') {
        // Subtract delivery price to get pure product sales
        const total = parseFloat(order.total_amount) || 0;
        const delivery = parseFloat(order.delivery_price) || 0;
        return total - delivery;
    }

    // If Category Filter is Active, sum ONLY items of that category
    if (!order.order_items) return 0;

    return order.order_items.reduce((sum, item) => {
        const product = analyticsState.products.find(p => String(p.id) === String(item.product_id));
        if (product && String(product.category_id) === String(analyticsState.filters.category)) {
            return sum + ((parseFloat(item.unit_price) || 0) * (item.quantity || 1));
        }
        return sum;
    }, 0);
};

const updateKPICards = (filteredOrders) => {
    const totalOrders = filteredOrders.length;

    const totalSales = filteredOrders.reduce((sum, order) => {
        return sum + getOrderValueForMetrics(order);
    }, 0);

    const avgTicket = totalOrders > 0 ? (totalSales / totalOrders) : 0;

    const totalDelivery = filteredOrders.reduce((sum, order) => {
        // Only count delivery if no category filter, OR we decide to show it anyway
        // Logic: sum delivery of all filtered orders
        return sum + (parseFloat(order.delivery_price) || 0);
    }, 0);

    // Calculate Most Sold Product
    const productCounts = {};
    filteredOrders.forEach(order => {
        if (!order.order_items) return;
        order.order_items.forEach(item => {
            // Check if item matches current category filter
            if (analyticsState.filters.category !== 'all') {
                const product = analyticsState.products.find(p => String(p.id) === String(item.product_id));
                if (!product || String(product.category_id) !== String(analyticsState.filters.category)) return;
            }

            const name = item.product_name || 'Desconocido';
            productCounts[name] = (productCounts[name] || 0) + (item.quantity || 1);
        });
    });

    let bestSellingProduct = '-';
    let maxCount = 0;

    Object.entries(productCounts).forEach(([name, count]) => {
        if (count > maxCount) {
            maxCount = count;
            bestSellingProduct = name;
        }
    });

    // Calculate Most Used Payment Method
    const paymentCounts = {};
    filteredOrders.forEach(order => {
        const method = order.payment_method || 'Desconocido';
        paymentCounts[method] = (paymentCounts[method] || 0) + 1;
    });

    let bestPaymentMethod = '-';
    let maxPaymentCount = 0;

    Object.entries(paymentCounts).forEach(([method, count]) => {
        if (count > maxPaymentCount) {
            maxPaymentCount = count;
            bestPaymentMethod = method;
        }
    });

    // Capitalize first letter of payment method
    if (bestPaymentMethod !== '-') {
        bestPaymentMethod = bestPaymentMethod.charAt(0).toUpperCase() + bestPaymentMethod.slice(1);
    }

    // Update UI elements
    if (elements.totalOrders) elements.totalOrders.textContent = totalOrders;
    if (elements.totalSales) elements.totalSales.textContent = formatCurrency(totalSales);
    if (elements.avgTicket) elements.avgTicket.textContent = formatCurrency(avgTicket);
    if (elements.totalDelivery) elements.totalDelivery.textContent = formatCurrency(totalDelivery);

    if (elements.mostSoldProduct) {
        elements.mostSoldProduct.textContent = maxCount > 0 ? `${bestSellingProduct} (${maxCount})` : '-';
    }

    if (elements.mostUsedPaymentDisplay) {
        elements.mostUsedPaymentDisplay.textContent = maxPaymentCount > 0 ? `${bestPaymentMethod} (${maxPaymentCount})` : '-';
    }
};

const updateCharts = (orders) => {
    updateOrdersChart(orders);
    updateSalesChart(orders);
    updateCategoryChart(orders);
};

const updateOrdersChart = (orders) => {
    if (!analyticsState.charts.ordersOverTime) return;

    const dataMap = new Map();

    orders.forEach(order => {
        const date = new Date(order.created_at);
        const key = date.toISOString().split('T')[0];
        dataMap.set(key, (dataMap.get(key) || 0) + 1);
    });

    const sortedKeys = Array.from(dataMap.keys()).sort();
    const data = sortedKeys.map(k => dataMap.get(k));

    const option = {
        title: { text: 'Pedidos en el tiempo', left: 'center' },
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: sortedKeys },
        yAxis: { type: 'value' },
        series: [{ data: data, type: 'line', smooth: true, color: '#6366f1', areaStyle: { opacity: 0.1 } }]
    };

    analyticsState.charts.ordersOverTime.setOption(option);
};

const updateSalesChart = (orders) => {
    if (!analyticsState.charts.salesOverTime) return;

    const dataMap = new Map();

    orders.forEach(order => {
        const date = new Date(order.created_at);
        const key = date.toISOString().split('T')[0];

        // Strict calculation per order
        const amount = getOrderValueForMetrics(order);

        dataMap.set(key, (dataMap.get(key) || 0) + amount);
    });

    const sortedKeys = Array.from(dataMap.keys()).sort();
    const data = sortedKeys.map(k => dataMap.get(k));

    const option = {
        title: { text: 'Ventas en el tiempo', left: 'center' },
        tooltip: { trigger: 'axis', formatter: (params) => params[0].name + '<br/>' + formatCurrency(params[0].value) },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: sortedKeys },
        yAxis: { type: 'value' },
        series: [{ data: data, type: 'bar', color: '#10b981', itemStyle: { borderRadius: [4, 4, 0, 0] } }]
    };

    analyticsState.charts.salesOverTime.setOption(option);
};

const updateCategoryChart = (filteredOrders) => {
    if (!analyticsState.charts.salesByCategory) return;

    const categorySales = new Map();
    const activeCategoryFilter = analyticsState.filters.category;

    filteredOrders.forEach(order => {
        if (!order.order_items) return;

        order.order_items.forEach(item => {
            if (!item.product_id) return;

            const product = analyticsState.products.find(p => String(p.id) === String(item.product_id));
            if (!product) return;

            // Check if this ITEM matches the active category filter (if any)
            const isMatch = activeCategoryFilter === 'all' || String(product.category_id) === String(activeCategoryFilter);

            if (!isMatch) return;

            const category = analyticsState.categories.find(c => String(c.id) === String(product.category_id));
            const categoryName = category ? category.name : 'Sin Categoría';

            const itemTotal = (parseFloat(item.unit_price) || 0) * (item.quantity || 1);
            categorySales.set(categoryName, (categorySales.get(categoryName) || 0) + itemTotal);
        });
    });

    const data = Array.from(categorySales.entries()).map(([name, value]) => ({
        value,
        name
    })).sort((a, b) => b.value - a.value);

    const option = {
        title: { text: 'Ventas por Categoría', left: 'center' },
        tooltip: {
            trigger: 'item',
            formatter: (params) => `${params.name}: ${formatCurrency(params.value)} (${params.percent}%)`
        },
        legend: {
            top: 'bottom',
            left: 'center'
        },
        series: [
            {
                name: 'Ventas por Categoría',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: false,
                    position: 'center'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 20,
                        fontWeight: 'bold'
                    }
                },
                labelLine: { show: false },
                data: data.length ? data : [{ value: 0, name: 'Sin Ventas', itemStyle: { color: '#e2e8f0' } }]
            }
        ]
    };

    analyticsState.charts.salesByCategory.setOption(option);
};

// Utils
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);
};
