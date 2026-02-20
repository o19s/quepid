// This controller uses global variables loaded via admin_users.js bundle
// CalHeatmap is available globally
import { Controller } from '@hotwired/stimulus';

export default class UserActivityController extends Controller {
  static values = {
    url: String,
    label: String,
  };

  connect() {
    console.log('UserActivityController connected');
    this.initializeHeatmap();
  }

  createTooltipElement() {
    const tooltip = document.createElement('div');
    tooltip.id = 'cal-tooltip';
    tooltip.style.display = 'none';
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = '#24292f';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '6px';
    tooltip.style.fontSize = '12px';
    tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
    tooltip.style.zIndex = '1000';
    tooltip.style.pointerEvents = 'none';
    this.element.appendChild(tooltip);

    return tooltip;
  }

  async initializeHeatmap() {
    const cal = new CalHeatmap();

    // Calculate date range (last 12 months)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Fetch actual data or use sample data for testing
    const data = await this.fetchData(startDate, tomorrow);
    //data = this.generateSampleData(startDate, now)

    // Paint the calendar with GitHub-style configuration
    cal.paint({
      itemSelector: this.element,
      domain: {
        type: 'month',
        gutter: 14,
        label: {
          text: 'MMM',
          textAlign: 'start',
          position: 'top',
        },
      },
      // Add CSS selector for each subDomain element to include the value as data attribute
      subDomain: {
        type: 'ghDay',
        radius: 2,
        width: 15,
        height: 15,
        gutter: 4,
      },
      range: 12,
      date: {
        start: startDate,
      },
      data: {
        source: data,
        type: 'json',
        x: 'date',
        y: 'value',
      },
    });

    // Add event handlers for tooltip
    let tooltip = this.createTooltipElement(cal);
    this.setupTooltipHandlers(cal, tooltip);
  }

  setupTooltipHandlers(cal, tooltip) {
    // Handle mouseover events for tooltips
    cal.on('mouseover', (event, timestamp, value) => {
      if (value > 0) {
        // Format the date nicely
        const date = new Date(timestamp).toISOString().split('T')[0];

        // Create tooltip content with proper singular/plural
        const label = value === 1 ? this.labelValue : `${this.labelValue}s`;
        tooltip.innerHTML = `${value} ${label} on ${date}`;

        // Position and show the tooltip near the mouse
        tooltip.style.display = 'block';
        tooltip.style.left = `${event.clientX + 1}px`;

        //tooltip.style.top = (event.clientY + window.scrollY + 10) + 'px'
      }
    });

    // Handle mouseout to hide tooltip
    cal.on('mouseout', () => {
      tooltip.style.display = 'none';
    });
  }

  async fetchData(startDate, endDate) {
    const start = this.formatDate(startDate);
    const end = this.formatDate(endDate);
    const url = `${this.urlValue}&start=${start}&end=${end}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();

      // Transform the data from timestamp: count to array of {date, value}
      // The backend returns Unix timestamps in seconds
      return Object.entries(rawData).map(([timestamp, count]) => {
        // The timestamp from backend is already in seconds, but may be a string
        const timestampNum = parseInt(timestamp);
        // Convert to milliseconds for JavaScript Date
        const date = new Date(timestampNum * 1000);
        return {
          date: date.toISOString().split('T')[0],
          value: count,
        };
      });
    } catch (error) {
      console.error('Error fetching activity data:', error);
      return [];
    }
  }

  // Helper method to generate sample data across the past year
  // which is useful in testing
  generateSampleData(startDate, endDate) {
    // let sampleData = [
    //   { date: '2025-01-01', value: 5 },
    //   { date: '2025-01-10', value: 15 },
    //   { date: '2025-01-20', value: 8 },
    //   { date: '2025-07-28', value: 80 },
    // ]

    const sampleData = [];
    const dayMillis = 24 * 60 * 60 * 1000;

    // Create a copy of the start date to avoid modifying the original
    const currentDate = new Date(startDate);

    // Generate data for each day with varying activity levels
    while (currentDate <= endDate) {
      // Skip some days to make the pattern more realistic (about 40% of days have activity)
      if (Math.random() > 0.6) {
        // Generate random activity count (1-15)
        const value = Math.floor(Math.random() * 15) + 1;

        sampleData.push({
          date: this.formatDate(currentDate),
          value: value,
        });
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Add some "hot" days with higher activity (for testing the color scale)
    const hotDays = 10;
    for (let i = 0; i < hotDays; i++) {
      // Random day within the range
      const randomDayOffset = Math.floor(Math.random() * ((endDate - startDate) / dayMillis));
      const randomDate = new Date(startDate.getTime() + randomDayOffset * dayMillis);

      sampleData.push({
        date: this.formatDate(randomDate),
        value: Math.floor(Math.random() * 20) + 15, // 15-35 value for "hot" days
      });
    }

    // Ensure we have at least a few days with values in current month for testing
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Add 5 days in current month with guaranteed values
    for (let i = 1; i <= 5; i++) {
      const day = Math.min(i * 5, 28); // Use days 5, 10, 15, 20, 25
      sampleData.push({
        date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        value: (i + 1) * 3, // Values: 6, 9, 12, 15, 18
      });
    }

    return sampleData;
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
