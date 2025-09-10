/**
 * Workspace Time Tracker Extension
 * Calculates and displays extra work minutes on Tatvasoft workspace time-log page
 * 
 * @version 1.0.1
 * @author Tatvasoft Developer
 */

class WorkspaceTimeTracker {
    constructor() {
        this.config = {
            MONTHLY_AVG_TIME: "08:30",
            TARGET_URL: 'https://workspace.tatvasoft.com/time-log/self',
            ELEMENT_ID: "extra-minutes-result",
            DEBOUNCE_DELAY: 300,
            EXTENSION_ATTRIBUTE: 'workspace-extra-time'
        };

        this.state = {
            observer: null,
            debounceTimer: null,
            isUpdating: false,
            eventListeners: new Map()
        };

        // Navigation tracking variables
        this.lastKnownUrl = window.location.href;
        this.urlCheckInterval = null;
        this.bodyObserver = null;

        this.init();
    }

    /**
     * Initialize the extension
     */
    init() {
        console.log('Initializing WorkspaceTimeTracker on:', window.location.href);
        
        // Always setup navigation handlers (even if not on target page)
        this.setupNavigationHandlers();
        
        if (!this.isOnTargetPage()) {
            console.log('Not on target page, cleaning up and waiting for navigation');
            this.cleanup();
            return;
        }

        console.log('On target page, starting tracking');
        this.startTracking();
    }

    /**
     * Check if current page matches target URL
     * @returns {boolean}
     */
    isOnTargetPage() {
        return window.location.href.includes(this.config.TARGET_URL);;
    }

    /**
     * Convert time string (HH:MM) to minutes
     * @param {string} timeStr - Time string in HH:MM format
     * @returns {number} Minutes
     */
    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        
        const timePattern = /^(-?)(\d{1,2}):(\d{2})$/;
        const match = timeStr.trim().match(timePattern);
        
        if (!match) return 0;
        
        const isNegative = match[1] === '-';
        const hours = parseInt(match[2], 10);
        const minutes = parseInt(match[3], 10);
        
        return (isNegative ? -1 : 1) * (hours * 60 + minutes);
    }

    /**
     * Convert minutes to HH:MM format
     * @param {number} minutes - Total minutes
     * @returns {string} Formatted time string
     */
    minutesToHHMM(minutes) {
        const sign = minutes < 0 ? '-' : '';
        const absoluteMinutes = Math.abs(minutes);
        const hours = Math.floor(absoluteMinutes / 60);
        const mins = absoluteMinutes % 60;
        
        return `${sign}${hours}:${mins.toString().padStart(2, '0')}`;
    }

    /**
     * Check URL every 1 second for SPA navigation changes
     */
    startUrlWatcher() {
        if (this.urlCheckInterval) clearInterval(this.urlCheckInterval);
        
        this.urlCheckInterval = setInterval(() => {
            const currentUrl = window.location.href;
            if (this.lastKnownUrl !== currentUrl) {
                this.lastKnownUrl = currentUrl;
                window.dispatchEvent(new Event('locationchange'));
            }
        }, 1000);
    }

    /**
     * Calculate extra minutes based on time log data
     * @returns {Object|null} Calculation result or null
     */
    calculateExtraMinutes() {
        const requiredPerDay = this.timeToMinutes(this.config.MONTHLY_AVG_TIME);
        const tableRows = document.querySelectorAll('.table-card tbody tr');
        
        if (tableRows.length === 0) return null;

        let totalMinutes = 0;
        let dayCount = 0;

        tableRows.forEach(row => {
            const timeString = this.extractTimeFromRow(row);
            
            if (this.isValidTimeFormat(timeString)) {
                totalMinutes += this.timeToMinutes(timeString);
                dayCount++;
            }
        });

        if (dayCount === 0) return null;

        const extraMinutes = totalMinutes - (requiredPerDay * dayCount);
        
        return {
            extraMinutes,
            totalMinutes,
            dayCount,
            requiredPerDay
        };
    }

    /**
     * Extract time string from table row
     * @param {HTMLTableRowElement} row - Table row element
     * @returns {string} Time string or empty string
     */
    extractTimeFromRow(row) {
        // Try last cell first
        const lastCell = row.querySelector('td:last-child');
        let timeString = lastCell?.textContent?.trim() || '';
        
        // Fallback to any cell matching HH:MM pattern
        if (!this.isValidTimeFormat(timeString)) {
            const timeCell = Array.from(row.querySelectorAll('td'))
                .find(cell => this.isValidTimeFormat(cell.textContent?.trim()));
            timeString = timeCell?.textContent?.trim() || '';
        }
        
        return timeString;
    }

    /**
     * Validate time format (HH:MM)
     * @param {string} timeStr - Time string to validate
     * @returns {boolean} Is valid format
     */
    isValidTimeFormat(timeStr) {
        return /^\d{1,2}:\d{2}$/.test(timeStr);
    }

    /**
     * Create or update the time tracker badge
     * @param {Object} result - Calculation result
     */
    updateBadge(result) {
        if (!result) return;

        const existingElement = document.getElementById(this.config.ELEMENT_ID);
        const badge = existingElement || this.createElement();
        
        this.applyStyles(badge);
        this.setContent(badge, result);
        this.attachEventHandlers(badge);
        
        if (!existingElement) {
            document.body.appendChild(badge);
        }
    }

    /**
     * Create badge element
     * @returns {HTMLDivElement} Badge element
     */
    createElement() {
        const element = document.createElement("div");
        element.id = this.config.ELEMENT_ID;
        element.setAttribute("data-extension", this.config.EXTENSION_ATTRIBUTE);
        element.setAttribute("data-collapsed", "true");
        return element;
    }

    /**
     * Apply styles to badge element
     * @param {HTMLDivElement} element - Badge element
     */
    applyStyles(element) {
        const baseStyles = {
            position: 'fixed',
            top: '15%',
            right: '0',
            color: 'black',
            transform: 'translateY(-50%)',
            zIndex: '99999',
            background: '#fff',
            borderRadius: '12px 0 0 12px',
            fontFamily: 'Arial,Helvetica,sans-serif',
            fontSize: '14px',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            transition: 'transform 0.3s ease',
            height: '60px',
            overflow: 'hidden'
        };

        Object.assign(element.style, baseStyles);
        this.updatePosition(element);
    }

    /**
     * Update badge position based on collapsed state
     * @param {HTMLDivElement} element - Badge element
     */
    updatePosition(element) {
        const isCollapsed = element.getAttribute("data-collapsed") === "true";
        const transform = isCollapsed 
            ? "translateY(-50%) translateX(calc(100% - 60px))" 
            : "translateY(-50%) translateX(0)";
        
        element.style.transform = transform;
    }

    /**
     * Set badge content
     * @param {HTMLDivElement} element - Badge element
     * @param {Object} result - Calculation result
     */
    setContent(element, result) {
        const isCollapsed = element.getAttribute("data-collapsed") === "true";
        const extraColor = this.getExtraMinutesColor(result.extraMinutes);
        
        element.innerHTML = `
            ${this.createToggleButton(isCollapsed)}
            ${this.createContentSection(result, extraColor)}
        `;
    }

    /**
     * Create toggle button HTML
     * @param {boolean} isCollapsed - Is badge collapsed
     * @returns {string} HTML string
     */
    createToggleButton(isCollapsed) {
        return `
            <div style="
                width:60px;
                height:60px;
                display:flex;
                align-items:center;
                justify-content:center;
                cursor:pointer;
                background:#0b2e58;
                color:#fff;
                font-size:18px;
                border-radius:12px 0 0 12px;
                transition:background-color 0.2s ease;
                flex-shrink:0;
            " id="extra-minutes-toggle">
                ${isCollapsed ? "⏱️" : "✕"}
            </div>
        `;
    }

    /**
     * Create content section HTML
     * @param {Object} result - Calculation result
     * @param {string} extraColor - Color for extra minutes
     * @returns {string} HTML string
     */
    createContentSection(result, extraColor) {
        return `
            <div id="extra-minutes-content" style="
                padding:0 20px;
                white-space:nowrap;
                min-width:280px;
                display:flex;
                align-items:center;
                gap:15px;
            ">
                ${this.createInfoCard("📊", "Days", result.dayCount)}
                ${this.createInfoCard("🕐", "Required", this.config.MONTHLY_AVG_TIME)}
                ${this.createInfoCard(
                    result.extraMinutes >= 0 ? "✅" : "⚠️", 
                    "Extra", 
                    `${result.extraMinutes} min (${this.minutesToHHMM(result.extraMinutes)})`,
                    extraColor
                )}
            </div>
        `;
    }

    /**
     * Create info card HTML
     * @param {string} icon - Card icon
     * @param {string} label - Card label
     * @param {string|number} value - Card value
     * @param {string} [color] - Optional text color
     * @returns {string} HTML string
     */
    createInfoCard(icon, label, value, color = '') {
        const colorStyle = color ? `color:${color}` : '';
        
        return `
            <div style="
                display:flex;
                align-items:center;
                gap:8px;
                padding:8px 12px;
                background:#f8fafc;
                border-radius:8px;
                border:1px solid #e2e8f0;
            ">
                <span>${icon}</span>
                <div>${label}: <b style="${colorStyle}">${value}</b></div>
            </div>
        `;
    }

    /**
     * Get color for extra minutes display
     * @param {number} extraMinutes - Extra minutes value
     * @returns {string} Color hex code
     */
    getExtraMinutesColor(extraMinutes) {
        if (extraMinutes > 0) return "#0c9a4a";
        if (extraMinutes < 0) return "#c62828";
        return "#888";
    }

    /**
     * Attach event handlers to badge
     * @param {HTMLDivElement} element - Badge element
     */
    attachEventHandlers(element) {
        this.removeExistingHandlers();
        
        const toggleButton = element.querySelector("#extra-minutes-toggle");
        if (toggleButton) {
            this.setupToggleHandler(element, toggleButton);
            this.setupHoverEffects(toggleButton);
        }
        
        this.setupGlobalHandlers(element);
    }

    /**
     * Setup toggle button handler
     * @param {HTMLDivElement} element - Badge element
     * @param {HTMLDivElement} toggleButton - Toggle button element
     */
    setupToggleHandler(element, toggleButton) {
        const handler = (event) => {
            event.stopPropagation();
            this.toggleBadgeState(element, toggleButton);
        };
        
        toggleButton.addEventListener('click', handler);
        this.state.eventListeners.set('toggle', handler);
    }

    /**
     * Toggle badge collapsed/expanded state
     * @param {HTMLDivElement} element - Badge element
     * @param {HTMLDivElement} toggleButton - Toggle button element
     */
    toggleBadgeState(element, toggleButton) {
        const isCollapsed = element.getAttribute("data-collapsed") === "true";
        
        if (isCollapsed) {
            element.style.transform = "translateY(-50%) translateX(0)";
            toggleButton.textContent = "✕";
            element.setAttribute("data-collapsed", "false");
        } else {
            element.style.transform = "translateY(-50%) translateX(calc(100% - 60px))";
            toggleButton.textContent = "⏱️";
            element.setAttribute("data-collapsed", "true");
        }
    }

    /**
     * Setup hover effects for toggle button
     * @param {HTMLDivElement} toggleButton - Toggle button element
     */
    setupHoverEffects(toggleButton) {
        const hoverInHandler = () => toggleButton.style.background = "#1e40af";
        const hoverOutHandler = () => toggleButton.style.background = "#0b2e58";
        
        toggleButton.addEventListener('mouseenter', hoverInHandler);
        toggleButton.addEventListener('mouseleave', hoverOutHandler);
        
        this.state.eventListeners.set('hoverIn', hoverInHandler);
        this.state.eventListeners.set('hoverOut', hoverOutHandler);
    }

    /**
     * Setup global event handlers (outside click, escape key)
     * @param {HTMLDivElement} element - Badge element
     */
    setupGlobalHandlers(element) {
        const outsideClickHandler = (event) => {
            if (!element.contains(event.target) && 
                element.getAttribute("data-collapsed") === "false") {
                this.collapseBadge(element);
            }
        };

        const escapeHandler = (event) => {
            if (event.key === 'Escape' && 
                element.getAttribute("data-collapsed") === "false") {
                this.collapseBadge(element);
            }
        };

        document.addEventListener('click', outsideClickHandler);
        document.addEventListener('keydown', escapeHandler);
        
        this.state.eventListeners.set('outsideClick', outsideClickHandler);
        this.state.eventListeners.set('escape', escapeHandler);
    }

    /**
     * Collapse the badge
     * @param {HTMLDivElement} element - Badge element
     */
    collapseBadge(element) {
        const toggleButton = element.querySelector("#extra-minutes-toggle");
        
        element.style.transform = "translateY(-50%) translateX(calc(100% - 60px))";
        if (toggleButton) toggleButton.textContent = "⏱️";
        element.setAttribute("data-collapsed", "true");
    }

    /**
     * Remove existing event handlers
     */
    removeExistingHandlers() {
        this.state.eventListeners.forEach((handler, type) => {
            switch (type) {
                case 'outsideClick':
                    document.removeEventListener('click', handler);
                    break;
                case 'escape':
                    document.removeEventListener('keydown', handler);
                    break;
            }
        });
      
        this.state.eventListeners.clear();
    }

    /**
     * Execute calculation and badge update
     */
    executeUpdate() {
        if (this.state.isUpdating) return;
        
        const calculationResult = this.calculateExtraMinutes();
        
        if (calculationResult) {
            this.state.isUpdating = true;
            
            try {
                this.updateBadge(calculationResult);
            } finally {
                this.state.isUpdating = false;
            }
        }
    }

    /**
     * Schedule update with debouncing
     */
    scheduleUpdate() {
        if (!this.isOnTargetPage()) {
            this.cleanup();
            return;
        }

        clearTimeout(this.state.debounceTimer);
        
        this.state.debounceTimer = setTimeout(() => {
            this.disconnectObserver();
            
            try {
                this.executeUpdate();
            } finally {
                this.reconnectObserver();
            }
        }, this.config.DEBOUNCE_DELAY);
    }

    /**
     * Start tracking time log changes
     */
    startTracking() {
        this.executeUpdate();
        this.setupMutationObserver();
    }

    /**
     * Setup mutation observer to watch for DOM changes
     */
    setupMutationObserver() {
        const targetContainer = this.getObserverTarget();
        
        this.state.observer = new MutationObserver((mutations) => {
            if (this.shouldIgnoreMutations(mutations)) return;
            this.scheduleUpdate();
        });

        this.state.observer.observe(targetContainer, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Get target element for mutation observer
     * @returns {Element} Target element
     */
    getObserverTarget() {
        return document.querySelector('.table-card') || 
               document.querySelector('.monthly-avg-time-log') || 
               document.body;
    }

    /**
     * Check if mutations should be ignored
     * @param {MutationRecord[]} mutations - DOM mutations
     * @returns {boolean} Should ignore mutations
     */
    shouldIgnoreMutations(mutations) {
        return mutations.some(mutation => 
            Array.from(mutation.addedNodes || []).some(node =>
                node.nodeType === 1 && 
                node.getAttribute?.('data-extension') === this.config.EXTENSION_ATTRIBUTE
            )
        );
    }

    /**
     * Disconnect mutation observer
     */
    disconnectObserver() {
        if (this.state.observer) {
            this.state.observer.disconnect();
        }
    }

    /**
     * Reconnect mutation observer
     */
    reconnectObserver() {
        if (this.state.observer) {
            const target = this.getObserverTarget();
            this.state.observer.observe(target, {
                childList: true,
                subtree: true
            });
        }
    }

    /**
     * Setup navigation event handlers
     */
    setupNavigationHandlers() {
        this.interceptHistoryMethods();
        this.setupNavigationListeners();
    }

    /**
     * Intercept browser history methods for SPA navigation
     */
    interceptHistoryMethods() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = (...args) => {
            originalPushState.apply(history, args);
            window.dispatchEvent(new Event('locationchange'));
        };

        history.replaceState = (...args) => {
            originalReplaceState.apply(history, args);
            window.dispatchEvent(new Event('locationchange'));
        };
    }

    /**
     * Setup navigation event listeners
     */
    setupNavigationListeners() {
        const navigationHandler = () => {
            if (this.isOnTargetPage()) {
                this.scheduleUpdate();
            } else {
                this.cleanup();
            }
        };

        window.addEventListener('popstate', () => {
            window.dispatchEvent(new Event('locationchange'));
        });
        
        window.addEventListener('locationchange', navigationHandler);
        
        this.startUrlWatcher();
    }

    /**
     * Clean up extension resources
     */
    cleanup() {
        this.removeBadge();
        this.disconnectObserver();
        this.removeExistingHandlers();
        
        if (this.state.debounceTimer) {
            clearTimeout(this.state.debounceTimer);
            this.state.debounceTimer = null;
        }
    }

    /**
     * Remove badge from DOM
     */
    removeBadge() {
        const existingBadge = document.getElementById(this.config.ELEMENT_ID);
        if (existingBadge) {
            existingBadge.remove();
        }
    }
}

// Initialize the extension immediately and also on DOM ready
const initializeExtension = () => {
    // Clean up any existing instance
    if (window.workspaceTimeTracker) {
        window.workspaceTimeTracker.cleanup();
    }
    
    // Create new instance
    window.workspaceTimeTracker = new WorkspaceTimeTracker();
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
}

// Also initialize on page load (for extra safety)
window.addEventListener('load', initializeExtension);