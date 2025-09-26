/**
 * Workspace Time Tracker Extension
 * Calculates and displays extra work minutes on Tatvasoft workspace time-log page
 * 
 * @version 1.0.2
 * @author Tatvasoft Developer
 */

class WorkspaceTimeTracker {
    constructor() {
        this.config = {
            MONTHLY_AVG_TIME: "08:30",
            HALF_DAY_TIME: "04:30",
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

        this.lastKnownUrl = window.location.href;
        this.urlCheckInterval = null;

        this.init();
    }

    init() {
        console.log('Initializing WorkspaceTimeTracker on:', window.location.href);
        
        this.startUrlWatcher();
        
        if (this.isOnTargetPage()) {
            console.log('On target page, starting tracking');
            this.startTracking();
        } else {
            console.log('Not on target page, waiting for navigation');
            this.cleanup();
        }
    }

    isOnTargetPage() {
        return window.location.href.includes(this.config.TARGET_URL);
    }

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

    minutesToHHMM(minutes) {
        const sign = minutes < 0 ? '-' : '';
        const absoluteMinutes = Math.abs(minutes);
        const hours = Math.floor(absoluteMinutes / 60);
        const mins = absoluteMinutes % 60;
        
        return `${sign}${hours}:${mins.toString().padStart(2, '0')}`;
    }

    startUrlWatcher() {
        if (this.urlCheckInterval) {
            clearInterval(this.urlCheckInterval);
        }
        
        this.urlCheckInterval = setInterval(() => {
            const currentUrl = window.location.href;
            if (this.lastKnownUrl !== currentUrl) {
                this.lastKnownUrl = currentUrl;
                this.handleUrlChange();
            }
        }, 1000);
    }

    handleUrlChange() {
        if (this.isOnTargetPage()) {
            this.startTracking();
        } else {
            this.cleanup();
        }
    }

    calculateExtraMinutes() {
        const requiredPerDay = this.timeToMinutes(this.config.MONTHLY_AVG_TIME);
        const halfDayTime = this.timeToMinutes(this.config.HALF_DAY_TIME);
        const tableRows = document.querySelectorAll('.table-card tbody tr');
        
        if (tableRows.length === 0) return null;

        let totalMinutes = 0;
        let fullDayCount = 0;
        let halfDayCount = 0;
        let dayCount = 0;

        tableRows.forEach(row => {
            const timeString = this.extractTimeFromRow(row);
            const attendance = this.extractAttendance(row).toLowerCase();
            
            if (this.isValidTimeFormat(timeString)) {
                totalMinutes += this.timeToMinutes(timeString);
                dayCount++;

                if (attendance.includes("half")) {
                    halfDayCount++;
                } else {
                    fullDayCount++;
                }
            }
        });

        const extraMinutes = totalMinutes - (requiredPerDay * fullDayCount) - (halfDayTime * halfDayCount);
        
        return {
            extraMinutes,
            totalMinutes,
            dayCount,
            requiredPerDay
        };
    }

    extractTimeFromRow(row) {
        const lastCell = row.querySelector('td:last-child');
        let timeString = lastCell?.textContent?.trim() || '';
        
        if (!this.isValidTimeFormat(timeString)) {
            const timeCell = Array.from(row.querySelectorAll('td'))
                .find(cell => this.isValidTimeFormat(cell.textContent?.trim()));
            timeString = timeCell?.textContent?.trim() || '';
        }
        
        return timeString;
    }

    extractAttendance(row) {
        const lastCell = row.querySelector('.cdk-column-Attendance .status-badge');
        return lastCell?.textContent?.trim() || '';
    }

    isValidTimeFormat(timeStr) {
        return /^\d{1,2}:\d{2}$/.test(timeStr);
    }

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

    createElement() {
        const element = document.createElement("div");
        element.id = this.config.ELEMENT_ID;
        element.setAttribute("data-extension", this.config.EXTENSION_ATTRIBUTE);
        element.setAttribute("data-collapsed", "true");
        return element;
    }

    applyStyles(element) {
        Object.assign(element.style, {
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
        });

        this.updatePosition(element);
    }

    updatePosition(element) {
        const isCollapsed = element.getAttribute("data-collapsed") === "true";
        element.style.transform = isCollapsed 
            ? "translateY(-50%) translateX(calc(100% - 60px))" 
            : "translateY(-50%) translateX(0)";
    }

    setContent(element, result) {
        const isCollapsed = element.getAttribute("data-collapsed") === "true";
        const extraColor = this.getExtraMinutesColor(result.extraMinutes);
        
        element.innerHTML = `
            ${this.createToggleButton(isCollapsed)}
            ${this.createContentSection(result, extraColor)}
        `;
    }

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

    getExtraMinutesColor(extraMinutes) {
        if (extraMinutes > 0) return "#0c9a4a";
        if (extraMinutes < 0) return "#c62828";
        return "#888";
    }

    attachEventHandlers(element) {
        this.removeExistingHandlers();
        
        const toggleButton = element.querySelector("#extra-minutes-toggle");
        if (!toggleButton) return;
        
        // Toggle functionality
        const toggleHandler = (event) => {
            event.stopPropagation();
            this.toggleBadgeState(element, toggleButton);
        };
        toggleButton.addEventListener('click', toggleHandler);
        this.state.eventListeners.set('toggle', toggleHandler);
        
        // Hover effects
        const hoverInHandler = () => toggleButton.style.background = "#1e40af";
        const hoverOutHandler = () => toggleButton.style.background = "#0b2e58";
        toggleButton.addEventListener('mouseenter', hoverInHandler);
        toggleButton.addEventListener('mouseleave', hoverOutHandler);
        this.state.eventListeners.set('hoverIn', hoverInHandler);
        this.state.eventListeners.set('hoverOut', hoverOutHandler);
        
        // Global handlers
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

    collapseBadge(element) {
        const toggleButton = element.querySelector("#extra-minutes-toggle");
        
        element.style.transform = "translateY(-50%) translateX(calc(100% - 60px))";
        if (toggleButton) toggleButton.textContent = "⏱️";
        element.setAttribute("data-collapsed", "true");
    }

    removeExistingHandlers() {
        this.state.eventListeners.forEach((handler, type) => {
            if (type === 'outsideClick') {
                document.removeEventListener('click', handler);
            } else if (type === 'escape') {
                document.removeEventListener('keydown', handler);
            }
        });
        this.state.eventListeners.clear();
    }

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

    scheduleUpdate() {
        if (!this.isOnTargetPage()) {
            this.cleanup();
            return;
        }

        if (this.state.debounceTimer) {
            clearTimeout(this.state.debounceTimer);
        }
        
        this.state.debounceTimer = setTimeout(() => {
            this.disconnectObserver();
            
            try {
                this.executeUpdate();
            } finally {
                this.reconnectObserver();
            }
        }, this.config.DEBOUNCE_DELAY);
    }

    startTracking() {
        this.executeUpdate();
        this.setupMutationObserver();
    }

    setupMutationObserver() {
        const targetContainer = document.querySelector('.table-card') || 
                               document.querySelector('.monthly-avg-time-log') || 
                               document.body;
        
        this.state.observer = new MutationObserver((mutations) => {
            // Ignore mutations from our own extension
            const shouldIgnore = mutations.some(mutation => 
                Array.from(mutation.addedNodes || []).some(node =>
                    node.nodeType === 1 && 
                    node.getAttribute?.('data-extension') === this.config.EXTENSION_ATTRIBUTE
                )
            );
            
            if (!shouldIgnore) {
                this.scheduleUpdate();
            }
        });

        this.state.observer.observe(targetContainer, {
            childList: true,
            subtree: true
        });
    }

    disconnectObserver() {
        if (this.state.observer) {
            this.state.observer.disconnect();
        }
    }

    reconnectObserver() {
        if (this.state.observer) {
            const targetContainer = document.querySelector('.table-card') || 
                                   document.querySelector('.monthly-avg-time-log') || 
                                   document.body;
            this.state.observer.observe(targetContainer, {
                childList: true,
                subtree: true
            });
        }
    }

    cleanup() {
        this.removeBadge();
        this.disconnectObserver();
        this.removeExistingHandlers();
        
        if (this.state.debounceTimer) {
            clearTimeout(this.state.debounceTimer);
            this.state.debounceTimer = null;
        }
    }

    removeBadge() {
        const existingBadge = document.getElementById(this.config.ELEMENT_ID);
        if (existingBadge) {
            existingBadge.remove();
        }
    }
}

// Initialize extension
const initializeExtension = () => {
    if (window.workspaceTimeTracker) {
        window.workspaceTimeTracker.cleanup();
    }
    
    window.workspaceTimeTracker = new WorkspaceTimeTracker();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}