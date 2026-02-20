import { Controller } from '@hotwired/stimulus';
import { apiFetch } from 'api/fetch';
import { getQuepidRootUrl, buildApiUrl, buildPageUrl, reloadOrTurboVisit } from 'utils/quepid_root';

// Handles the Judgements modal: list books from case's teams, select/change book, refresh ratings from book.
// Replaces the Angular judgements component. Uses apiFetch and buildApiUrl.
export default class extends Controller {
  static values = {
    caseId: Number,
    bookId: Number,
    queriesCount: Number,
    teams: Array,
    createBookUrl: String,
  };

  static targets = [
    'modal',
    'trigger',
    'loadingEl',
    'noTeamsEl',
    'noBooksEl',
    'booksSection',
    'bookList',
    'createMissingQueries',
    'createBookLink',
    'createBookLinkFooter',
    'judgeLink',
    'refreshBtn',
    'primaryBtn',
    'errorEl',
  ];

  connect() {
    this._modal = null;
    this._books = [];
    this._selectedBookId = null;
    this._selectedBookName = null;

    this._boundBookListClick = (e) => this._handleBookListClick(e);
    if (this.hasBookListTarget) {
      this.bookListTarget.addEventListener('click', this._boundBookListClick);
    }
  }

  disconnect() {
    if (this.hasBookListTarget) {
      this.bookListTarget.removeEventListener('click', this._boundBookListClick);
    }
  }

  _handleBookListClick(event) {
    const li = event.target.closest('li[data-book-id]');
    if (!li) return;
    if (li.dataset.bookId === '') {
      this._selectBook(null, null);
      return;
    }
    const book = this._books.find((b) => String(b.id) === li.dataset.bookId);
    this._selectBook(book?.id ?? li.dataset.bookId, book?.name ?? li.dataset.bookName);
  }

  get rootUrl() {
    return getQuepidRootUrl();
  }

  get currentBookId() {
    const v = this.bookIdValue;
    return v === undefined || v === null || v === '' ? null : v;
  }

  async open(event) {
    event.preventDefault();
    if (!this._modal) {
      const el = this.modalTarget;
      this._modal =
        window.bootstrap?.Modal?.getOrCreateInstance(el) ?? new window.bootstrap.Modal(el);
    }
    this._hideError();
    this._showLoading(true);
    this._books = [];
    this._selectedBookId = this.currentBookId;
    this._selectedBookName = null;
    const teams = Array.isArray(this.teamsValue) ? this.teamsValue : [];
    if (teams.length === 0) {
      this._showLoading(false);
      if (this.hasNoTeamsElTarget) this.noTeamsElTarget.classList.remove('d-none');
      this._modal.show();
      return;
    }
    const root = this.rootUrl;
    const seen = new Set();
    for (const team of teams) {
      const tid = team?.id ?? team;
      if (!tid) continue;
      const url = buildApiUrl(root, 'teams', tid, 'books');
      try {
        const res = await apiFetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) continue;
        const data = await res.json();
        const list = data.books || data;
        for (const b of list) {
          const id = b.id ?? b;
          const name = b.name ?? `Book ${id}`;
          if (!seen.has(id)) {
            seen.add(id);
            this._books.push({ id, name });
          }
        }
      } catch (_e) {
        // skip failed team
      }
    }
    this._books.sort((a, b) => {
      if (a.id === this.currentBookId) return -1;
      if (b.id === this.currentBookId) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    if (this._books.find((b) => b.id === this._selectedBookId)) {
      this._selectedBookName = this._books.find((b) => b.id === this._selectedBookId).name;
    }
    this._showLoading(false);
    if (this.hasNoTeamsElTarget) this.noTeamsElTarget.classList.add('d-none');
    if (this._books.length === 0) {
      if (this.hasNoBooksElTarget) {
        this.noBooksElTarget.classList.remove('d-none');
        const link = this.noBooksElTarget.querySelector(
          "a[data-judgements-target='createBookLink']"
        );
        if (link && this.createBookUrlValue) link.href = this.createBookUrlValue;
      }
      if (this.hasBooksSectionTarget) this.booksSectionTarget.classList.add('d-none');
    } else {
      if (this.hasNoBooksElTarget) this.noBooksElTarget.classList.add('d-none');
      if (this.hasBooksSectionTarget) this.booksSectionTarget.classList.remove('d-none');
      this._renderBookList();
    }
    const createLinks = this.hasCreateBookLinkTarget ? [this.createBookLinkTarget] : [];
    if (this.hasCreateBookLinkFooterTarget) createLinks.push(this.createBookLinkFooterTarget);
    createLinks.forEach((a) => {
      a.href = this.createBookUrlValue || '#';
    });
    this._syncButtons();
    this._modal.show();
  }

  _showLoading(show) {
    if (this.hasLoadingElTarget) this.loadingElTarget.classList.toggle('d-none', !show);
  }

  _hideError() {
    if (this.hasErrorElTarget) {
      this.errorElTarget.classList.add('d-none');
      this.errorElTarget.textContent = '';
    }
  }

  _showError(msg) {
    if (this.hasErrorElTarget) {
      this.errorElTarget.textContent = msg;
      this.errorElTarget.classList.remove('d-none');
    }
  }

  _renderBookList() {
    if (!this.hasBookListTarget) return;
    const list = this.bookListTarget;
    list.innerHTML = '';
    const noneLi = document.createElement('li');
    noneLi.className = 'list-group-item list-group-item-action';
    noneLi.dataset.bookId = '';
    noneLi.dataset.bookName = '';
    noneLi.textContent = this.currentBookId ? 'None (unselect current book)' : 'None';
    if (this._selectedBookId === null) noneLi.classList.add('active');
    list.appendChild(noneLi);
    for (const b of this._books) {
      const li = document.createElement('li');
      li.className = 'list-group-item list-group-item-action';
      li.dataset.bookId = b.id;
      li.dataset.bookName = b.name;
      li.textContent = b.name;
      if (this._selectedBookId === b.id) li.classList.add('active');
      list.appendChild(li);
    }
  }

  _selectBook(id, name) {
    this._selectedBookId = id;
    this._selectedBookName = name;
    this.bookListTarget.querySelectorAll('li').forEach((li) => {
      li.classList.toggle(
        'active',
        (li.dataset.bookId || null) === (id === null ? '' : String(id))
      );
    });
    this._syncButtons();
  }

  _syncButtons() {
    const current = this.currentBookId;
    const selected = this._selectedBookId;
    if (this.hasJudgeLinkTarget) {
      if (selected) {
        this.judgeLinkTarget.href = buildPageUrl(this.rootUrl, 'books', selected, 'judge');
        this.judgeLinkTarget.classList.remove('d-none');
      } else {
        this.judgeLinkTarget.classList.add('d-none');
      }
    }
    const canRefresh = selected && current === selected;
    if (this.hasRefreshBtnTarget) {
      this.refreshBtnTarget.disabled = !canRefresh;
      this.refreshBtnTarget.innerHTML =
        canRefresh && this._selectedBookName
          ? `Refresh ratings from book <em>${this._escapeHtml(this._selectedBookName)}</em>`
          : 'Refresh ratings from book';
    }
    let primaryLabel = '';
    if (current === null && selected) primaryLabel = 'Select Book';
    else if (current !== null && selected === null) primaryLabel = 'Unselect Book';
    else if (current !== selected && selected !== null) primaryLabel = 'Change Book';
    if (this.hasPrimaryBtnTarget) {
      this.primaryBtnTarget.classList.toggle('d-none', !primaryLabel);
      this.primaryBtnTarget.textContent = primaryLabel;
    }
  }

  goToTeams(event) {
    event.preventDefault();
    this._modal?.hide();
    window.location.href = buildPageUrl(this.rootUrl, 'teams');
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async primaryAction(event) {
    event.preventDefault();
    const selected = this._selectedBookId;
    const current = this.currentBookId;
    if (selected === current) return;
    this._hideError();
    const root = this.rootUrl;
    const url = buildApiUrl(root, 'cases', this.caseIdValue);
    this.primaryBtnTarget.disabled = true;
    try {
      const res = await apiFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ book_id: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || res.statusText);
      }
      if (window.flash) window.flash.success = 'Book updated.';
      if (selected) {
        await this._doRefresh(selected, root);
      } else {
        this._modal?.hide();
        reloadOrTurboVisit();
      }
    } catch (err) {
      this._showError(err.message || 'Failed to update book.');
    } finally {
      this.primaryBtnTarget.disabled = false;
    }
  }

  async refreshFromBook(event) {
    event.preventDefault();
    const selected = this._selectedBookId;
    if (!selected) return;
    this._hideError();
    await this._doRefresh(selected, this.rootUrl);
  }

  async _doRefresh(bookId, root) {
    const createMissing =
      this.hasCreateMissingQueriesTarget && this.createMissingQueriesTarget.checked;
    const inBackground = this.queriesCountValue >= 50;
    let url = buildApiUrl(root, 'books', bookId, 'cases', this.caseIdValue, 'refresh');
    url += `?create_missing_queries=${createMissing}`;
    if (inBackground) url += '&process_in_background=true';
    this.refreshBtnTarget.disabled = true;
    try {
      const res = await apiFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || res.statusText);
      }
      if (window.flash)
        window.flash.success = inBackground
          ? 'Ratings are being refreshed in the background.'
          : 'Ratings have been refreshed.';
      this._modal?.hide();
      if (inBackground) {
        setTimeout(() => {
          window.location.href = buildPageUrl(root);
        }, 500);
      } else {
        reloadOrTurboVisit();
      }
    } catch (err) {
      this._showError(err.message || 'Failed to refresh ratings.');
    } finally {
      this.refreshBtnTarget.disabled = false;
    }
  }
}
