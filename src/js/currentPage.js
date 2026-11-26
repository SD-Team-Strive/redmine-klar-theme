// =============================================================================
// Chili: tell assistive technology which menu item is the current page.
// Redmine marks it only with the class "selected"; the theme also marks Home,
// My page, Workload and Administration by the page (see "show which top-menu
// item the page belongs to" in _chili.scss). Same items, as aria-current.
// =============================================================================

const CURRENT_ITEMS = [
  '#top-menu a.selected',
  '#main-menu a.selected',
  '.flyout-menu a.selected',
  'body.controller-welcome :is(#top-menu, .flyout-menu) a.home',
  'body.controller-my.action-page :is(#top-menu, .flyout-menu) a.my-page',
  'body.controller-workloads :is(#top-menu, .flyout-menu) a.WorkLoad',
  'body:has(#admin-menu) :is(#top-menu, .flyout-menu) a.administration',
].join(', ');

export function markCurrentPage() {
  document.querySelectorAll(CURRENT_ITEMS).forEach((link) => {
    link.setAttribute('aria-current', 'page');
  });
}
