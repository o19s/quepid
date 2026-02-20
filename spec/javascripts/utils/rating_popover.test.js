// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import {
  buildRatingPopoverContent,
  disposePopovers,
  toggleRatingPopover,
} from 'utils/rating_popover';

describe('rating_popover', () => {
  // ── buildRatingPopoverContent ─────────────────────────────────────

  describe('buildRatingPopoverContent', () => {
    it('creates buttons for each scale value plus a Clear button', () => {
      const wrapper = buildRatingPopoverContent('doc1', [0, 1, 2, 3]);

      const buttons = wrapper.querySelectorAll('button');
      expect(buttons).toHaveLength(5); // 4 scale + 1 clear
      expect(buttons[0].textContent).toBe('0');
      expect(buttons[0].dataset.ratingValue).toBe('0');
      expect(buttons[1].textContent).toBe('1');
      expect(buttons[2].textContent).toBe('2');
      expect(buttons[3].textContent).toBe('3');
      expect(buttons[4].textContent).toBe('Clear');
      expect(buttons[4].dataset.ratingValue).toBe('');
    });

    it('sets data-rating-doc-id on the wrapper', () => {
      const wrapper = buildRatingPopoverContent('my-doc-id', [0, 1]);

      expect(wrapper.dataset.ratingDocId).toBe('my-doc-id');
    });

    it('adds labels as title and small text when provided', () => {
      const labels = { 0: 'Bad', 3: 'Perfect' };
      const wrapper = buildRatingPopoverContent('doc1', [0, 1, 2, 3], labels);

      const buttons = wrapper.querySelectorAll('button[data-rating-value]');
      // Button 0 should have label
      expect(buttons[0].title).toBe('Bad');
      expect(buttons[0].querySelector('small').textContent).toContain('Bad');
      // Button 1 has no label
      expect(buttons[1].title).toBe('');
      expect(buttons[1].querySelector('small')).toBeNull();
      // Button 3 has label
      expect(buttons[3].title).toBe('Perfect');
    });

    it('uses default scale [0,1,2,3] when scale is null', () => {
      const wrapper = buildRatingPopoverContent('doc1', null);

      const buttons = wrapper.querySelectorAll('button');
      // 4 default scale + 1 clear
      expect(buttons).toHaveLength(5);
    });
  });

  // ── disposePopovers ───────────────────────────────────────────────

  describe('disposePopovers', () => {
    it('calls dispose on all popovers and clears the map', () => {
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();
      const map = new Map([
        ['doc1', { dispose: dispose1 }],
        ['doc2', { dispose: dispose2 }],
      ]);

      disposePopovers(map);

      expect(dispose1).toHaveBeenCalledOnce();
      expect(dispose2).toHaveBeenCalledOnce();
      expect(map.size).toBe(0);
    });

    it('ignores errors from dispose', () => {
      const map = new Map([
        [
          'doc1',
          {
            dispose: () => {
              throw new Error('already disposed');
            },
          },
        ],
      ]);

      expect(() => disposePopovers(map)).not.toThrow();
      expect(map.size).toBe(0);
    });

    it('handles empty map', () => {
      const map = new Map();
      expect(() => disposePopovers(map)).not.toThrow();
    });
  });

  // ── toggleRatingPopover ───────────────────────────────────────────

  describe('toggleRatingPopover', () => {
    it('toggles existing popover if already in map', () => {
      const toggle = vi.fn();
      const map = new Map([['doc1', { toggle }]]);
      const triggerEl = document.createElement('span');

      toggleRatingPopover(map, triggerEl, 'doc1', [0, 1, 2, 3]);

      expect(toggle).toHaveBeenCalledOnce();
    });

    it('returns early if bootstrap.Popover is not available', () => {
      window.bootstrap = undefined;
      const map = new Map();
      const triggerEl = document.createElement('span');

      toggleRatingPopover(map, triggerEl, 'doc1', [0, 1, 2, 3]);

      expect(map.size).toBe(0);
    });

    it('creates and shows a new popover when bootstrap is available', () => {
      const showFn = vi.fn();
      const constructorArgs = [];
      class MockPopover {
        constructor(...args) {
          constructorArgs.push(args);
          this.show = showFn;
        }
      }
      window.bootstrap = { Popover: MockPopover };

      const map = new Map();
      const triggerEl = document.createElement('span');

      toggleRatingPopover(map, triggerEl, 'doc1', [0, 1, 2, 3]);

      expect(constructorArgs).toHaveLength(1);
      expect(showFn).toHaveBeenCalledOnce();
      expect(map.has('doc1')).toBe(true);

      // Verify popover options
      const opts = constructorArgs[0][1];
      expect(opts.html).toBe(true);
      expect(opts.trigger).toBe('manual');
      expect(opts.placement).toBe('left');
      expect(opts.container).toBe('body');
    });
  });
});
