import { Controller } from '@hotwired/stimulus';

// Color lookup matching the Angular qscoreSvc.scoreToColor()
const SCORE_COLORS = {
  '-1': 'hsl(0, 100%, 40%)',
  0: 'hsl(5, 95%, 45%)',
  1: 'hsl(10, 90%, 50%)',
  2: 'hsl(15, 85%, 55%)',
  3: 'hsl(20, 80%, 60%)',
  4: 'hsl(24, 75%, 65%)',
  5: 'hsl(28, 65%, 75%)',
  6: 'hsl(60, 55%, 65%)',
  7: 'hsl(70, 70%, 50%)',
  8: 'hsl(80, 80%, 45%)',
  9: 'hsl(90, 85%, 40%)',
  10: 'hsl(100, 90%, 35%)',
};

const DEFAULT_COLOR = 'hsl(0, 0%, 0%, 0.5)';
const PENDING_COLOR = 'hsl(0, 0%, 91%)';

// Handles dynamic score updates for both qscore-query and qscore-case
// components. Listens for "qscore:update" custom events dispatched after
// scoring runs, and re-renders the score badge with the new color.
//
// Replaces the Angular qscoreSvc + $scope.$watchGroup pattern.
export default class extends Controller {
  static values = {
    score: { type: String, default: '?' },
    maxScore: { type: Number, default: 100 },
    queryId: Number,
    caseId: Number,
  };

  static targets = ['rating', 'scoreText', 'label'];

  connect() {
    this._boundUpdate = this._handleScoreEvent.bind(this);
    this._initialRender = true;
    document.addEventListener('qscore:update', this._boundUpdate);
  }

  disconnect() {
    document.removeEventListener('qscore:update', this._boundUpdate);
  }

  // Called when score/maxScore values change via Stimulus value callbacks
  scoreValueChanged() {
    this._render();
  }
  maxScoreValueChanged() {
    this._render();
  }

  // External event handler: expects detail { queryId, caseId, score, maxScore, backgroundColor }
  _handleScoreEvent(event) {
    const d = event.detail || {};

    // Match by queryId or caseId
    if (this.hasQueryIdValue && d.queryId && d.queryId === this.queryIdValue) {
      this._applyUpdate(d);
    } else if (this.hasCaseIdValue && d.caseId && d.caseId === this.caseIdValue) {
      this._applyUpdate(d);
    }
  }

  _applyUpdate(detail) {
    const oldScore = parseFloat(this.scoreValue);
    if (detail.score !== undefined) this.scoreValue = String(detail.score);
    if (detail.maxScore !== undefined) this.maxScoreValue = detail.maxScore;
    if (detail.backgroundColor) {
      this._setColor(detail.backgroundColor);
    }

    // Animate the score transition (skip on initial render)
    const newScore = parseFloat(this.scoreValue);
    if (!this._initialRender && !isNaN(oldScore) && !isNaN(newScore) && oldScore !== newScore) {
      this._animateScore(oldScore, newScore);
    }
  }

  _render() {
    const color = this._scoreToColor(this.scoreValue, this.maxScoreValue);
    this._setColor(color);

    if (this.hasScoreTextTarget) {
      this.scoreTextTarget.textContent = this._formatScore(this.scoreValue);
    }

    // Mark initial render done after first paint
    if (this._initialRender) {
      requestAnimationFrame(() => {
        this._initialRender = false;
      });
    }
  }

  _setColor(color) {
    if (this.hasRatingTarget) {
      this.ratingTarget.style.backgroundColor = color;
    }
  }

  _scoreToColor(score, maxScore) {
    if (score === null || score === undefined || score === '?' || score === '') {
      return DEFAULT_COLOR;
    }
    if (score === '--' || score === 'zsr') {
      return PENDING_COLOR;
    }

    const num = parseFloat(score);
    if (isNaN(num) || !maxScore || maxScore <= 0) return DEFAULT_COLOR;

    // Match Angular: parseInt truncates, then Math.round on division by 10
    const clamped = Math.min(num, maxScore);
    const scaled = parseInt((clamped * 100) / maxScore, 10);
    const bucket = Math.round(scaled / 10);
    return SCORE_COLORS[String(bucket)] || DEFAULT_COLOR;
  }

  _animateScore(from, to) {
    if (!this.hasScoreTextTarget) return;
    const duration = 600;
    const start = performance.now();
    const target = this.scoreTextTarget;

    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // EaseOut cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      target.textContent = current.toFixed(2);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        target.textContent = this._formatScore(String(to));
      }
    };

    requestAnimationFrame(step);
  }

  _formatScore(score) {
    const num = parseFloat(score);
    if (!isNaN(num)) return num.toFixed(2);
    return score || '?';
  }
}
