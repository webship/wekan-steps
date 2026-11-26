'use strict';

// Test content and one card.
//
// A scenario makes its own cards through the site's REST API, as the managing account, and they go after it. A card
// opens over its board, at /b/<board id>/<slug>/<card id>, in a panel with its labels, its members (the assignee and
// the creator), its list (a picker that moves it), its time (the spent hours and the days they were logged on), its
// checklists and its comments, and its Card Actions menu (Move Card to Archive, after a confirmation). Each step works
// in that panel or in the popup it opens, and waits for the panel to show what it did.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wekan-helpers');

/** The list the open card's panel names: its picker's, or the plain name a read-only member sees. */
async function listShown(world) {
  const it = h.item(world, 'List');
  const summary = it.locator('details.card-details-list-picker > summary');
  if (await summary.count()) return h.tidy(await summary.first().innerText({ timeout: 2000 }));
  return h.tidy((await it.innerText({ timeout: 2000 })).replace(/^\s*List\s*/, ''));
}

/** The full names of the open card's assignees. */
async function assignees(world) {
  const titles = await h.item(world, 'Assignee').locator('a.js-assignee').evaluateAll((as) => as.map((a) => a.getAttribute('title') || ''));
  return titles.map(h.memberName);
}

/**
 * A card of the scenario's own, made through the site's API as the managing account in a list of a board; it goes
 * after the scenario. Name it "Webship test …".
 *
 * Example #1: Given there is a card "Webship test work" in the list "To Do" of the board "Webship site"
 * Example #2: Given there is a card "Webship test move" in the list "Doing" of the board "Webship site"
 * Example #3: And there is a card "Webship test work" in the list "To Do" of the board "Webship site"
 * Example #4: And there is a card "Webship test archive" in the list "Done" of the board "Webship site"
 * Example #5: When there is a card "Webship test label" in the list "To Do" of the board "Webship site"
 */
Given(/^there is a card "([^"]*)" in the list "([^"]*)" of the board "([^"]*)"$/, async function (title, listTitle, boardTitle) {
  const board = await h.findBoard(this, boardTitle);
  h.state(this).board = board.title;
  await h.makeCard(this, board, listTitle, title);
});

/**
 * No open card of this title on a board: the ones a stopped run left are removed first, as the managing account.
 *
 * Example #1: Given there is no card "Webship test new" on the board "Webship site"
 * Example #2: Given there is no card "Webship test made" on the board "Webship site"
 * Example #3: And there is no card "Webship test new" on the board "Webship site"
 * Example #4: And there is no card "Webship test made" on the board "Webship site"
 * Example #5: When there is no card "Webship test new" on the board "Webship site"
 */
Given(/^there is no card "([^"]*)" on the board "([^"]*)"$/, async function (title, boardTitle) {
  const board = await h.findBoard(this, boardTitle);
  h.state(this).board = board.title;
  for (const card of await h.findCards(this, board, title)) await h.removeCard(this, card._id);
});

/**
 * Open a card by its title, on the scenario's board (the one a step named last, else the default board): its panel
 * over the board.
 *
 * Example #1: When I open the card "Webship test work"
 * Example #2: When I open the card "The greeting script says Helo instead of Hello"
 * Example #3: And I open the card "Webship test work"
 * Example #4: And we open the card "The usage line spells greeting as greting"
 * Example #5: Given I open the card "Webship test work"
 */
When(/^(I |we )*open the card "([^"]*)"$/, async function (_who, title) {
  const card = await h.cardNamed(this, title);
  await h.openCard(this, card);
});

/**
 * Move the open card to another list of its board, with its list picker.
 *
 * Example #1: When I move the card to the list "Doing"
 * Example #2: When I move the card to the list "Done"
 * Example #3: And I move the card to the list "Doing"
 * Example #4: And we move the card to the list "To Do"
 * Example #5: Then I move the card to the list "Done"
 */
When(/^(I |we )*move the card to the list "([^"]*)"$/, async function (_who, list) {
  const panel = h.details(this);
  await h.actOrExplain('move the card', list, async () => {
    // The picker is a <details>. After a move the site draws the card's panel again, a moment later, and a picker
    // opened before that is closed by it: the picker is opened (only when it is closed) and its list clicked, again,
    // until the click lands.
    const picker = panel.locator('details.card-details-list-picker').first();
    await picker.waitFor({ state: 'visible', timeout: h.budget(this) });
    const option = picker.locator('.card-details-list-options [role="option"]').filter({ hasText: h.exactly(list) }).first();
    const deadline = Date.now() + h.budget(this);
    for (;;) {
      try {
        if (!(await picker.evaluate((d) => d.open))) await picker.locator('summary').first().click({ timeout: 3000 });
        await option.click({ timeout: 3000 });
        break;
      } catch (err) {
        if (Date.now() > deadline) throw err;
        await this.page.waitForTimeout(500);
      }
    }
    await panel.locator('details.card-details-list-picker > summary').filter({ hasText: h.exactly(list) }).first().waitFor({ state: 'visible', timeout: h.budget(this) });
  }, `The card's List picker offers the lists of its board; a read-only member has none. Is "${list}" a list of the board?`);
});

/**
 * The open card is in a list: the list its panel names (the site's own answer when the account may not move it).
 *
 * Example #1: Then the card should be in the list "Doing"
 * Example #2: Then the card should be in the list "Done"
 * Example #3: And the card should be in the list "Doing"
 * Example #4: But the card should be in the list "To Do"
 * Example #5: Given the card should be in the list "Doing"
 */
Then(/^the card should be in the list "([^"]*)"$/, async function (list) {
  const result = await h.waitForValue(() => listShown(this), (v) => h.exactly(list).test(v), h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected the card to be in the list "${list}", but its panel says "${result.value || 'nothing'}".`, hint: 'A card\'s list is the one its panel names under List.' });
});

/**
 * Comment on the open card: its comment box, then Comment; the step waits for the comment in the card.
 *
 * Example #1: When I add the comment "Checked on the test site" to the card
 * Example #2: When we add the comment "Webship test: a note" to the card
 * Example #3: And I add the comment "Checked on the test site" to the card
 * Example #4: And we add the comment "Webship test: a note" to the card
 * Example #5: Then I add the comment "Checked on the test site" to the card
 */
When(/^(I |we )*add the comment "([^"]*)" to the card$/, async function (_who, text) {
  const panel = h.details(this);
  await h.actOrExplain('comment on the card', text, async () => {
    const box = panel.locator('form.js-new-comment-form textarea.js-new-comment-input').first();
    await box.click({ timeout: h.budget(this) });
    await box.fill(text);
    await panel.locator('form.js-new-comment-form button.js-add-comment').first().click({ timeout: h.budget(this) });
    await panel.locator('.comment .comment-text').filter({ hasText: new RegExp(h.words(text)) }).first().waitFor({ state: 'visible', timeout: h.budget(this) });
  }, 'The card\'s comment box is under Comments; a read-only member has none.');
});

/**
 * The open card shows a comment.
 *
 * Example #1: Then the card should show the comment "Checked on the test site"
 * Example #2: Then the card should show the comment "Seen on the test site: the greeting prints Helo."
 * Example #3: And the card should show the comment "Checked on the test site"
 * Example #4: But the card should show the comment "Seen on the test site"
 * Example #5: Given the card should show the comment "Checked on the test site"
 */
Then(/^the card should show the comment "([^"]*)"$/, async function (text) {
  const comment = h.details(this).locator('.comment .comment-text').filter({ hasText: new RegExp(h.words(text)) });
  await h.assertPresence(comment, null, { label: `the comment "${text}"`, hint: 'A card\'s comments are under Comments, the newest first.', timeout: h.budget(this) });
});

/**
 * The open card shows a comment by a person, as the site names them.
 *
 * Example #1: Then the card should show the comment "Checked on the test site" by "Member Test"
 * Example #2: Then the card should show the comment "Seen on the test site" by "Owner Test"
 * Example #3: And the card should show the comment "Checked on the test site" by "Member Test"
 * Example #4: But the card should show the comment "Seen on the test site" by "Owner Test"
 * Example #5: Given the card should show the comment "Checked on the test site" by "Member Test"
 */
Then(/^the card should show the comment "([^"]*)" by "([^"]*)"$/, async function (text, who) {
  const comment = h.details(this).locator('.comment')
    .filter({ has: this.page.locator('.comment-member', { hasText: h.exactly(who) }) })
    .filter({ has: this.page.locator('.comment-text', { hasText: new RegExp(h.words(text)) }) });
  await h.assertPresence(comment, null, { label: `the comment "${text}" by ${who}`, hint: 'A comment shows its author\'s full name over its text.', timeout: h.budget(this) });
});

/**
 * Put a label of the board on the open card: its Labels popup, then the label. A board's labels are its own.
 *
 * Example #1: When I add the label "bug" to the card
 * Example #2: When we add the label "bug" to the card
 * Example #3: And I add the label "bug" to the card
 * Example #4: And we add the label "bug" to the card
 * Example #5: Then I add the label "bug" to the card
 */
When(/^(I |we )*add the label "([^"]*)" to the card$/, async function (_who, label) {
  const panel = h.details(this);
  await h.actOrExplain('label the card', label, async () => {
    await panel.locator('.card-details-item-labels a.js-add-labels').last().click({ timeout: h.budget(this) });
    const choice = h.popup(this).locator('li.js-card-label-item .js-select-label').filter({ hasText: h.exactly(label) }).first();
    await choice.waitFor({ state: 'visible', timeout: h.budget(this) });
    if (!/\bactive\b/.test(String(await choice.getAttribute('class')))) await choice.click();
    await h.closePopup(this);
    await panel.locator('.card-details-item-labels .card-label:not(.add-label)').filter({ hasText: h.exactly(label) }).first().waitFor({ state: 'visible', timeout: h.budget(this) });
  }, `The Labels popup offers the board's labels: is "${label}" one of them? A read-only member has no Labels popup.`);
});

/**
 * The open card has a label, or has not.
 *
 * Example #1: Then the card should have the label "bug"
 * Example #2: Then the card should not have the label "bug"
 * Example #3: And the card should have the label "bug"
 * Example #4: But the card should not have the label "bug"
 * Example #5: Given the card should have the label "bug"
 */
Then(/^the card should( not)? have the label "([^"]*)"$/, async function (notCase, label) {
  const found = h.details(this).locator('.card-details-item-labels .card-label:not(.add-label)').filter({ hasText: h.exactly(label) });
  await h.assertPresence(found, notCase, { label: `the label "${label}" on the card`, hint: 'A card\'s labels are at the top of its panel.', timeout: h.budget(this) });
});

/**
 * Assign the open card to a member of its board, by their full name: its Assignee popup, then the person.
 *
 * Example #1: When I assign the card to "Owner Test"
 * Example #2: When we assign the card to "Member Test"
 * Example #3: And I assign the card to "Owner Test"
 * Example #4: And we assign the card to "Member Test"
 * Example #5: Then I assign the card to "Owner Test"
 */
When(/^(I |we )*assign the card to "([^"]*)"$/, async function (_who, who) {
  const panel = h.details(this);
  await h.actOrExplain('assign the card', who, async () => {
    await panel.locator('a.js-add-assignees').first().click({ timeout: h.budget(this) });
    const person = h.popup(this).locator('a.js-select-assignee').filter({ hasText: new RegExp(`^\\s*\\S*\\s*${h.words(who)}\\s*\\(`) }).first();
    await person.click({ timeout: h.budget(this) });
    await h.closePopup(this);
    const result = await h.waitForValue(() => assignees(this), (names) => names.some((n) => h.exactly(who).test(n)), h.budget(this));
    if (!result.ok) throw new Error(`the card's assignees are ${(result.value || []).join(', ') || 'none'}`);
  }, `The Assignee popup offers the board's members by their full names: is "${who}" one of them? A read-only member has no Assignee popup.`);
});

/**
 * The open card is assigned to a person, by their full name.
 *
 * Example #1: Then the card should be assigned to "Owner Test"
 * Example #2: Then the card should be assigned to "Member Test"
 * Example #3: And the card should be assigned to "Owner Test"
 * Example #4: But the card should be assigned to "Member Test"
 * Example #5: Given the card should be assigned to "Owner Test"
 */
Then(/^the card should be assigned to "([^"]*)"$/, async function (who) {
  const result = await h.waitForValue(() => assignees(this), (names) => names.some((n) => h.exactly(who).test(n)), h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected the card to be assigned to "${who}", but its assignees are ${(result.value || []).join(', ') || 'none'}.`, hint: 'A card\'s assignees are under Assignee, each by their full name.' });
});

/**
 * The open card was made by a person, as its panel's Creator names them.
 *
 * Example #1: Then the card should be created by "Owner Test"
 * Example #2: Then the card should be created by "Member Test"
 * Example #3: And the card should be created by "Owner Test"
 * Example #4: But the card should be created by "Member Test"
 * Example #5: Given the card should be created by "Owner Test"
 */
Then(/^the card should be created by "([^"]*)"$/, async function (who) {
  const result = await h.waitForValue(async () => h.memberName(await h.item(this, 'Creator').locator('a.member').first().getAttribute('title', { timeout: 2000 })), (name) => h.exactly(who).test(name), h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected the card to be created by "${who}", but its Creator is "${result.value || 'nobody'}".`, hint: 'A card\'s maker is under Creator, by their full name.' });
});

/**
 * The open card has an item in one of its checklists.
 *
 * Example #1: Then the card should have the checklist item "Fix the spelling in greeting.sh"
 * Example #2: Then the card should have the checklist item "Fix the spelling"
 * Example #3: And the card should have the checklist item "Fix the spelling in greeting.sh"
 * Example #4: But the card should have the checklist item "Fix the spelling"
 * Example #5: Given the card should have the checklist item "Fix the spelling in greeting.sh"
 */
Then(/^the card should have the checklist item "([^"]*)"$/, async function (text) {
  const found = h.details(this).locator('.checklist .js-checklist-item').filter({ hasText: new RegExp(h.words(text)) });
  await h.assertPresence(found, null, { label: `the checklist item "${text}"`, hint: 'A card\'s checklists are under Checklists, each with its items.', timeout: h.budget(this) });
});

/**
 * The open card shows time logged on it by a person: its Spent time menu lists the days, each with its hours and who
 * logged them. The step reads them and closes the popup; it logs nothing.
 *
 * Example #1: Then the card should show the time "0.5 h" logged by "Member Test"
 * Example #2: Then the card should show the time "1 h" logged by "Owner Test"
 * Example #3: And the card should show the time "0.5 h" logged by "Member Test"
 * Example #4: But the card should show the time "1 h" logged by "Owner Test"
 * Example #5: Given the card should show the time "0.5 h" logged by "Member Test"
 */
Then(/^the card should show the time "([^"]*)" logged by "([^"]*)"$/, async function (hours, who) {
  const page = this.page;
  const menu = h.details(this).locator('a.js-section-spent-time').first();
  if (!(await menu.isVisible().catch(() => false))) {
    throw friendly({ message: 'The card has no Spent time menu to read its days from.', hint: 'The days of a card\'s time are in its Spent time menu, under Time; a read-only member has no menu.' });
  }
  await menu.click({ timeout: h.budget(this) });
  try {
    const entry = h.popup(this).locator('.time-entry-list li')
      .filter({ has: page.locator('.time-entry-hours', { hasText: h.exactly(hours) }) })
      .filter({ has: page.locator('.time-entry-who', { hasText: h.exactly(who) }) });
    await h.assertPresence(entry, null, { label: `${hours} logged by ${who}`, hint: 'Each day of the card\'s time shows its date, its hours ("0.5 h") and who logged them.', timeout: h.budget(this) });
  } finally {
    await h.closePopup(this);
  }
});

/**
 * Move the open card to the archive: its Card Actions, Move Card to Archive, and the confirmation. The card leaves its
 * board.
 *
 * Example #1: When I archive the card
 * Example #2: When we archive the card
 * Example #3: And I archive the card
 * Example #4: And we archive the card
 * Example #5: Then I archive the card
 */
When(/^(I |we )*archive the card$/, async function (_who) {
  const panel = h.details(this);
  await h.actOrExplain('archive the card', h.state(this).title || 'the card', async () => {
    await panel.locator('a.js-open-card-details-menu').first().click({ timeout: h.budget(this) });
    await h.popup(this).locator('a.js-archive').first().click({ timeout: h.budget(this) });
    await h.popup(this).locator('button.js-confirm').first().click({ timeout: h.budget(this) });
    await panel.waitFor({ state: 'detached', timeout: h.budget(this) });
  }, 'A card is archived from its Card Actions menu (its panel\'s menu), Move Card to Archive, then Move to Archive.');
  const result = await h.waitForValue(() => h.cardNow(this), (c) => c && c.archived === true, h.budget(this));
  if (!result.ok) throw friendly({ message: 'The card was not archived.', hint: 'The site archives a card once its confirmation is clicked.' });
});
