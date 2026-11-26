'use strict';

// A board and its lists, a new card, who may open a board and change its cards, and the board's sprints.
//
// A board opens at /b/<board id>/<slug> on its lists, side by side in its swimlane; an archived card is not on it. A
// list's "Add Card" opens a composer at its foot. A read-only member gets the board without "Add Card" and a card
// without its pickers and its comment box; an account the board does not have gets "Board not found". The board's
// view (Swimlanes by default) is the person's own setting: its menu, in the board's header, also opens the Sprints of
// Scrum planning; the steps put the view the person had back after the scenario.

const { When, Then, After } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wekan-helpers');

/** A list of the open board, by its title. */
function listOnBoard(world, title) {
  return world.page.locator('.list.js-list').filter({ has: world.page.locator('.list-header h2.list-header-name', { hasText: h.exactly(title) }) }).first();
}

/** Open a board, as the managing account names it, and wait for its lists. */
async function openBoard(world, title) {
  const board = await h.findBoard(world, title);
  h.state(world).board = board.title;
  await h.open(world, `/b/${board.id}/${board.slug}`);
  return board;
}

/**
 * Open a board by its title: its lists.
 *
 * Example #1: When I open the board "Webship site"
 * Example #2: When we open the board "Webship site"
 * Example #3: And I open the board "Webship site"
 * Example #4: And we open the board "Webship site"
 * Example #5: Given I open the board "Webship site"
 */
When(/^(I |we )*open the board "([^"]*)"$/, async function (_who, title) {
  await openBoard(this, title);
  await h.assertPresence(this.page.locator('.list.js-list .list-header-name'), null, { label: 'the lists of the board', hint: 'The account must be one the board has; the board shows its lists side by side.', timeout: h.budget(this) });
});

/**
 * A list of the open board shows a card, or does not.
 *
 * Example #1: Then the list "Doing" should show the card "The greeting script says Helo instead of Hello"
 * Example #2: Then the list "To Do" should not show the card "Webship test archive"
 * Example #3: And the list "To Do" should show the card "The usage line spells greeting as greting"
 * Example #4: But the list "Done" should not show the card "The greeting script says Helo instead of Hello"
 * Example #5: Given the list "Done" should show the card "Add a test for the greeting"
 */
Then(/^the list "([^"]*)" should( not)? show the card "([^"]*)"$/, async function (list, notCase, title) {
  const column = listOnBoard(this, list);
  await h.assertPresence(column, null, { label: `the list "${list}"`, hint: 'Open the board first; a list is named over its cards.', timeout: h.budget(this) });
  const card = column.locator('.minicard .minicard-title').filter({ hasText: h.exactly(title) });
  await h.assertPresence(card, notCase, { label: `the card "${title}" in the list "${list}"`, hint: 'A list shows its open cards; an archived card is not on the board.', timeout: h.budget(this) });
});

/**
 * Add a card to a list of the open board, the way a person does: the list's "Add Card", its title, Add. It goes after
 * the scenario. Name it "Webship test …".
 *
 * Example #1: When I add the card "Webship test new" to the list "To Do"
 * Example #2: When we add the card "Webship test made" to the list "Doing"
 * Example #3: And I add the card "Webship test new" to the list "To Do"
 * Example #4: And we add the card "Webship test made" to the list "Doing"
 * Example #5: Then I add the card "Webship test new" to the list "To Do"
 */
When(/^(I |we )*add the card "([^"]*)" to the list "([^"]*)"$/, async function (_who, title, list) {
  const column = listOnBoard(this, list);
  await h.actOrExplain('add the card', title, async () => {
    await column.locator('a.open-minicard-composer').first().click({ timeout: h.budget(this) });
    const box = column.locator('form.js-inlined-form textarea.js-card-title').first();
    await box.fill(title);
    await column.locator('form.js-inlined-form button.confirm').first().click({ timeout: h.budget(this) });
    await column.locator('.minicard .minicard-title').filter({ hasText: h.exactly(title) }).first().waitFor({ state: 'visible', timeout: h.budget(this) });
  }, `The list's "Add Card" opens a composer at its foot; a read-only member has none. Is "${list}" a list of the open board?`);
  const board = await h.findBoard(this, h.state(this).board);
  const result = await h.waitForValue(() => h.findCards(this, board, title), (cards) => cards.length > 0, h.budget(this));
  if (!result.ok) throw friendly({ message: `The card "${title}" does not show on ${board.title} through the site's API.`, hint: 'A card added on the board is on the board for the site\'s API too.' });
  for (const card of result.value) h.remember(this, card._id);
});

/**
 * The browser's account may not open a board: the site says "Board not found", and shows none of its lists.
 *
 * Example #1: Then I should be refused the board "Webship site"
 * Example #2: Then we should be refused the board "Webship site"
 * Example #3: And I should be refused the board "Webship site"
 * Example #4: But we should be refused the board "Webship site"
 * Example #5: Given I should be refused the board "Webship site"
 */
Then(/^(I |we )*should be refused the board "([^"]*)"$/, async function (_who, title) {
  await openBoard(this, title);
  await h.assertPresence(this.page.getByText('Board not found', { exact: true }), null, { label: 'the site\'s "Board not found"', hint: 'An account the board has may open it; the site tells only one it does not have that the board is not found.', timeout: h.budget(this) });
  const lists = await this.page.locator('.list.js-list').count();
  if (lists) throw friendly({ message: `Expected the board "${title}" to be refused, but it shows ${lists} list(s).`, hint: 'A refused board shows none of its lists.' });
});

/**
 * The browser's account may not add a card to a list of the open board: the list has no "Add Card".
 *
 * Example #1: Then I should not be able to add a card to the list "To Do"
 * Example #2: Then we should not be able to add a card to the list "Doing"
 * Example #3: And I should not be able to add a card to the list "To Do"
 * Example #4: But we should not be able to add a card to the list "Doing"
 * Example #5: Given I should not be able to add a card to the list "To Do"
 */
Then(/^(I |we )*should not be able to add a card to the list "([^"]*)"$/, async function (_who, list) {
  const column = listOnBoard(this, list);
  await h.assertPresence(column, null, { label: `the list "${list}"`, hint: 'Open the board first; a list is named over its cards.', timeout: h.budget(this) });
  const add = column.locator('a.open-minicard-composer, a.js-add-card');
  await h.assertPresence(add, 'not', { label: `"Add Card" in the list "${list}"`, hint: 'A member who may change the board\'s cards gets "Add Card" in each list; a read-only member gets none.', timeout: h.budget(this) });
});

/**
 * The browser's account may not change the open card: its panel has no list picker, no Labels popup and no Assignee
 * popup.
 *
 * Example #1: Then I should not be able to change the card
 * Example #2: Then we should not be able to change the card
 * Example #3: And I should not be able to change the card
 * Example #4: But we should not be able to change the card
 * Example #5: Given I should not be able to change the card
 */
Then(/^(I |we )*should not be able to change the card$/, async function (_who) {
  const panel = h.details(this);
  await h.assertPresence(panel.locator('h2.card-details-title'), null, { label: 'the card\'s panel', hint: 'Open the card first: When I open the card "…".', timeout: h.budget(this) });
  const controls = panel.locator('details.card-details-list-picker, a.js-add-labels, a.js-add-assignees, a.js-section-spent-time');
  await h.assertPresence(controls, 'not', { label: 'a control that changes the card (its list picker, its Labels or Assignee popup, its Spent time menu)', hint: 'A member who may change the card gets them; a read-only member gets none.', timeout: h.budget(this) });
});

/**
 * The browser's account may not comment on the open card: its panel has no comment box.
 *
 * Example #1: Then I should not be able to comment on the card
 * Example #2: Then we should not be able to comment on the card
 * Example #3: And I should not be able to comment on the card
 * Example #4: But we should not be able to comment on the card
 * Example #5: Given I should not be able to comment on the card
 */
Then(/^(I |we )*should not be able to comment on the card$/, async function (_who) {
  const panel = h.details(this);
  await h.assertPresence(panel.locator('h2.card-details-title'), null, { label: 'the card\'s panel', hint: 'Open the card first: When I open the card "…".', timeout: h.budget(this) });
  await h.assertPresence(panel.locator('form.js-new-comment-form'), 'not', { label: 'the card\'s comment box', hint: 'A member who may comment gets a comment box under Comments; a read-only member gets none.', timeout: h.budget(this) });
});

/** The view the open board is in, as its header names it ("Swimlanes"). */
async function viewOf(world) {
  return h.tidy(await world.page.locator('a.js-toggle-board-view .board-header-btn-label').first().innerText({ timeout: h.budget(world) }));
}

/** Switch the open board's view through its menu, to an entry of the menu by its name ("Sprints", "Swimlanes"). */
async function switchView(world, name) {
  await world.page.locator('a.js-toggle-board-view').first().click({ timeout: h.budget(world) });
  await h.popup(world).locator('a.js-board-view-entry').filter({ hasText: h.exactly(name) }).first().click({ timeout: h.budget(world) });
  const result = await h.waitForValue(() => viewOf(world), (v) => h.exactly(name).test(v), h.budget(world));
  if (!result.ok) throw friendly({ message: `The board's view did not become ${name}: it is ${result.value || 'unknown'}.`, hint: 'The board\'s view menu is the button in its header that names the view (Swimlanes by default).' });
}

/**
 * Open the Sprints of a board's Scrum planning, through the board's view menu; the view the person had is put back
 * after the scenario.
 *
 * Example #1: When I open the sprints of the board "Webship site"
 * Example #2: When we open the sprints of the board "Webship site"
 * Example #3: And I open the sprints of the board "Webship site"
 * Example #4: And we open the sprints of the board "Webship site"
 * Example #5: Given I open the sprints of the board "Webship site"
 */
When(/^(I |we )*open the sprints of the board "([^"]*)"$/, async function (_who, title) {
  const board = await openBoard(this, title);
  const before = await viewOf(this).catch(() => '');
  if (!h.exactly('Sprints').test(before)) {
    h.state(this).restoreView = { board, view: before || 'Swimlanes' };
    await h.actOrExplain('open the sprints', title, () => switchView(this, 'Sprints'), 'The board\'s view menu (its header) opens the Sprints of Scrum planning.');
  }
  await h.assertPresence(this.page.locator('select.js-scrum-sprint'), null, { label: 'the sprints of the board', hint: 'The Sprints view lists the board\'s sprints once a board administrator has turned Scrum planning on.', timeout: h.budget(this) });
});

/**
 * A sprint of the open Sprints is active: the sprint list marks it "(Active)".
 *
 * Example #1: Then the sprint "Sprint 1" should be active
 * Example #2: Then the sprint "Sprint 2" should be active
 * Example #3: And the sprint "Sprint 1" should be active
 * Example #4: But the sprint "Sprint 2" should be active
 * Example #5: Given the sprint "Sprint 1" should be active
 */
Then(/^the sprint "([^"]*)" should be active$/, async function (name) {
  const result = await h.waitForValue(async () => (await this.page.locator('select.js-scrum-sprint option').allInnerTexts()).map(h.tidy), (names) => names.includes(`${name} (Active)`), h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected the sprint "${name}" to be active, but the sprints are ${(result.value || []).filter((n) => n !== '—').join(', ') || 'none'}.`, hint: 'Open the sprints of the board first; the active sprint is marked "(Active)".' });
});

/**
 * A sprint of the open Sprints has a card: the sprint is chosen, and its table lists the card in it.
 *
 * Example #1: Then the sprint "Sprint 1" should have the card "The greeting script says Helo instead of Hello"
 * Example #2: Then the sprint "Sprint 1" should have the card "The usage line spells greeting as greting"
 * Example #3: And the sprint "Sprint 1" should have the card "The greeting script says Helo instead of Hello"
 * Example #4: But the sprint "Sprint 1" should have the card "Add a test for the greeting"
 * Example #5: Given the sprint "Sprint 1" should have the card "The greeting script says Helo instead of Hello"
 */
Then(/^the sprint "([^"]*)" should have the card "([^"]*)"$/, async function (name, title) {
  const page = this.page;
  const select = page.locator('select.js-scrum-sprint').first();
  const option = select.locator('option').filter({ hasText: new RegExp(`^\\s*${h.words(name)}(\\s*\\([^)]*\\))?\\s*$`) }).first();
  if (!(await option.count())) throw friendly({ message: `There is no sprint "${name}" on the board.`, hint: 'Open the sprints of the board first; its sprints are in the Sprint list.' });
  await select.selectOption(await option.getAttribute('value'));
  const row = page.locator('table.scrum-table tbody tr[data-card-id]')
    .filter({ has: page.locator('td:nth-child(1)', { hasText: h.exactly(title) }) })
    .filter({ has: page.locator('td:nth-child(3)', { hasText: h.exactly(name) }) });
  await h.assertPresence(row, null, { label: `the card "${title}" in the sprint "${name}"`, hint: 'The chosen sprint\'s table lists its cards, each with the sprint it is in.', timeout: h.budget(this) });
});

// The board's view the person had is put back after a scenario that switched it.
After(async function () {
  const restore = this.wekan && this.wekan.restoreView;
  if (!restore) return;
  this.wekan.restoreView = null;
  try {
    await h.open(this, `/b/${restore.board.id}/${restore.board.slug}`);
    if (!h.exactly(restore.view).test(await viewOf(this))) await switchView(this, restore.view);
  } catch (e) {
    console.warn(`[wekan-steps] the board's view could not be put back to ${restore.view}: ${h.tidy(e && e.message).slice(0, 300)}`);
  }
});
