import { Controller } from '@hotwired/stimulus';

export default class extends Controller {
  static values = { link: String };

  copy(event) {
    event.preventDefault();
    const link = this.linkValue;
    const btn = event.currentTarget;
    if (!link) {
      if (window.flash) window.flash.error = 'No invite link available';
      return;
    }

    const setCopied = (text) => {
      const prev = btn.innerHTML;
      btn.innerHTML = text;
      setTimeout(() => {
        btn.innerHTML = prev;
      }, 1500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(
        () => setCopied('Copied'),
        () => {
          if (window.flash) window.flash.error = 'Copy failed';
        }
      );
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = link;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied('Copied');
      } catch (_e) {
        if (window.flash) window.flash.error = 'Copy failed';
      }
      document.body.removeChild(textarea);
    }
  }
}
