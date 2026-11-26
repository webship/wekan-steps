'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the plumbing the steps use and that
// another pack can require instead of copying: the wait budget, presence assertions with friendly errors, URL
// building, the users registry, signing in (the form, and a session put back: its cookie), the site's own REST API as
// the managing account (the test content a scenario makes and removes), the open card and its popups, and the cards a
// scenario made, which go after it.
//
// The site keeps a browser's session in its login cookie (`meteor_login_token`, a login token of the person): the
// steps read who the session is by asking the site's REST API with it, and every login token a run opened is revoked
// when the run ends (the site's POST /users/logout), so a run leaves no login behind.
//
// Everything here builds on webship-js's own helpers (`gotoUrl`, `smartSettle`, `waitForPageLoad`, `friendly`) so the
// steps behave like the core webship-js steps.

const { gotoUrl, smartSettle, waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');

let playwright;
try { playwright = require('playwright'); } catch { playwright = require(require.resolve('playwright', { paths: [require.resolve('webship-js/package.json')] })); }

/** The cookie the site keeps a browser's session in: a login token of the person. */
const SESSION_COOKIE = 'meteor_login_token';

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least 15 seconds (the site draws a board and
 * a card after the page has loaded), so a slow screen does not fail an assertion that would pass a moment later. Kept
 * below webship-js's 45 second step timeout.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 15000);
}

/**
 * Escape a literal string for use in a RegExp.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The source of a pattern for a text whose words may stand apart by any white space: a pattern of a locator tests the
 * element's whole text, where the site's markup can put two spaces or a line break between words.
 *
 * @param {string} text
 * @returns {string}
 */
function words(text) {
  return escapeRegExp(String(text).trim()).replace(/\s+/g, '\\s+');
}

/**
 * A RegExp that matches the whole text (ignoring surrounding space and case), for exact names and titles.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function exactly(text) {
  return new RegExp('^\\s*' + words(text) + '\\s*$', 'i');
}

/**
 * Collapse runs of white space and trim.
 *
 * @param {string} text
 * @returns {string}
 */
function tidy(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/**
 * Run an action and rethrow its failure as a friendly error (action, target, cause and a hint) instead of
 * Playwright's raw timeout stack.
 *
 * @param {string} label
 * @param {string} target
 * @param {Function} fn
 * @param {string} hint
 */
async function actOrExplain(label, target, fn, hint) {
  try {
    return await fn();
  } catch (err) {
    if (err && err.stack === err.message && /Hint:/.test(err.message)) throw err;
    throw friendly({ action: label, target, cause: err, hint });
  }
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match and fail with a friendly error
 * otherwise: the wait and the assertion are one call, so content that arrives a moment late still passes.
 *
 * @param {import('playwright').Locator} locator
 * @param {string|null|undefined} notCase
 * @param {{label: string, hint: string, timeout: number}} options
 */
async function assertPresence(locator, notCase, { label, hint, timeout }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout });
  } catch {
    throw friendly({
      message: notCase ? `Expected not to see ${label}, but it is still on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`,
      hint,
    });
  }
}

/**
 * Poll a reader until its value satisfies a test, and return the last value read, so a value that changes a moment
 * after the action (a card's list after a move) still passes.
 *
 * @param {Function} read - async () => value
 * @param {Function} test - (value) => boolean
 * @param {number} timeout
 * @param {number} [every] - milliseconds between two reads
 * @returns {Promise<{ok: boolean, value: *}>}
 */
async function waitForValue(read, test, timeout, every = 500) {
  const deadline = Date.now() + timeout;
  let value;
  for (;;) {
    try { value = await read(); } catch { value = undefined; }
    if (value !== undefined && test(value)) return { ok: true, value };
    if (Date.now() >= deadline) return { ok: false, value };
    await new Promise((resolve) => setTimeout(resolve, every));
  }
}

/**
 * The site root without a trailing slash.
 *
 * @param {object} world
 * @returns {string}
 */
function siteRoot(world) {
  return String(world.launchUrl).replace(/\/+$/, '');
}

/**
 * Join the site root and a path with exactly one slash. Absolute URLs pass through.
 *
 * @param {object} world
 * @param {string} url
 * @returns {string}
 */
function siteUrl(world, url) {
  if (!url) return siteRoot(world);
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/** The scenario's own state of this pack. */
function state(world) {
  world.wekan = world.wekan || {};
  return world.wekan;
}

/**
 * The login token of the browser's session (its cookie), or ''.
 *
 * @param {object} world
 * @returns {Promise<string>}
 */
async function sessionToken(world) {
  const cookie = (await world.context.cookies(siteRoot(world))).find((c) => c.name === SESSION_COOKIE);
  return cookie ? String(cookie.value) : '';
}

/**
 * Open a page of the site and wait for it to settle. After a page is loaded in full the site shows its sign-in page
 * for a moment while it takes the session back: with a session, the step waits until the site has left it.
 *
 * @param {object} world
 * @param {string} url
 */
async function open(world, url) {
  const target = siteUrl(world, url);
  await world.page.goto(target, { waitUntil: 'domcontentloaded', timeout: budget(world) * 2 });
  await waitForPageLoad(world.page, (world.minWaitTime && world.minWaitTime.page) || 3000);
  const wanted = new URL(target).pathname;
  if (wanted !== '/sign-in' && await sessionToken(world)) {
    await world.page.waitForURL((u) => new URL(String(u)).pathname !== '/sign-in', { timeout: budget(world) }).catch(() => {});
  }
}

/**
 * A user of the `users` registry in cucumber.js (`worldParameters.users`): the username the site signs in with
 * (`username`), its password, and the name the site shows (`name`).
 *
 * @param {object} world
 * @param {string} handle
 * @returns {{username: string, password: string, name: string}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The account "${handle}" is not in the users registry. Known accounts: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '${handle}', password: process.env.WEKAN_${handle.toUpperCase()}_PASSWORD, name: '${handle}' } }. The account itself is made once by the build of the site, never by a feature.`,
    });
  }
  if (!entry.password) {
    throw friendly({ message: `The account "${handle}" has no password in the users registry.`, hint: `Set WEKAN_${handle.toUpperCase()}_PASSWORD, or the password in worldParameters.users of cucumber.js.` });
  }
  return { username: String(entry.username || handle), password: String(entry.password), name: String(entry.name || entry.username || handle) };
}

// ---------------------------------------------------------------------------
// The site's REST API: the run's own client, apart from the browser
// ---------------------------------------------------------------------------

const apiContexts = new Map();
/** Every login token the run met (the browser's sessions and the managing account's): revoked when the run ends. */
const tokensSeen = new Map();

/** The run's own client of the site's REST API, apart from the browser and its cookies. */
async function apiContext(world) {
  const root = siteRoot(world);
  if (!apiContexts.has(root)) apiContexts.set(root, await playwright.request.newContext({ ignoreHTTPSErrors: true }));
  return apiContexts.get(root);
}

/** A login token the run opened: it is revoked when the run ends. */
function keepToken(world, token) {
  if (token) tokensSeen.set(token, siteRoot(world));
}

/**
 * One call of the site's REST API with a login token: [status, answer].
 *
 * @param {object} world
 * @param {string} method
 * @param {string} route - "/api/user"
 * @param {object|undefined} body
 * @param {string} token
 * @returns {Promise<[number, *]>}
 */
async function rest(world, method, route, body, token) {
  const request = await apiContext(world);
  const r = await request.fetch(siteUrl(world, route), {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { data: JSON.stringify(body) }),
    failOnStatusCode: false,
  });
  let answer = null;
  try { answer = await r.json(); } catch { answer = null; }
  return [r.status(), answer];
}

/**
 * The account of the browser's session, as the site's REST API names it for its login token: { name, username } or
 * null.
 *
 * @param {object} world
 * @returns {Promise<{name: string, username: string}|null>}
 */
async function currentAccount(world) {
  const token = await sessionToken(world);
  if (!token) return null;
  keepToken(world, token);
  const [status, me] = await rest(world, 'GET', '/api/user', undefined, token);
  if (status !== 200 || !me || !me.username) return null;
  return { name: String((me.profile && me.profile.fullname) || me.username), username: String(me.username) };
}

/** Whether the session is an account of the registry's, by its name or its username. */
function sessionIs(world, account, user) {
  if (!account) return false;
  const name = account.name.toLowerCase();
  return name === user.name.toLowerCase() || account.username.toLowerCase() === user.username.toLowerCase();
}

/** The name of the browser's session, or '' for none. */
async function currentUser(world) {
  const me = await currentAccount(world);
  return me ? me.name : '';
}

/** The browser forgets its session (its cookies); the login token is revoked when the run ends. */
async function dropSession(world) {
  const token = await sessionToken(world);
  keepToken(world, token);
  await world.context.clearCookies();
}

/** Fill and submit the sign-in form: the username, the password, Sign In. */
async function submitLogin(world, username, password) {
  await open(world, '/sign-in');
  const page = world.page;
  await page.locator('#at-field-username_and_email').waitFor({ state: 'visible', timeout: budget(world) });
  await page.locator('#at-field-username_and_email').fill(username);
  await page.locator('#at-field-password').fill(password);
  await page.locator('#at-btn').click();
}

/** What the sign-in form says, or ''. */
async function loginSays(world) {
  return tidy(await world.page.locator('.at-error').first().innerText({ timeout: 1500 }).catch(() => ''));
}

const sessions = new Map();

/**
 * Sign in with an account of the users registry and make sure the session is that account's. An account that is
 * already signed in is kept; an account that signed in earlier in the run gets its session back (its cookie);
 * otherwise the account goes through the sign-in form.
 *
 * @param {object} world
 * @param {string} handle
 */
async function signInAs(world, handle) {
  const user = resolveUser(world, handle);
  const key = siteRoot(world) + '|' + handle;
  if (sessionIs(world, await currentAccount(world), user)) return;
  await dropSession(world);
  const saved = sessions.get(key);
  if (saved) {
    await world.context.addCookies(saved);
    if (sessionIs(world, await currentAccount(world), user)) return;
    sessions.delete(key);
    await dropSession(world);
  }
  await submitLogin(world, user.username, user.password);
  const result = await waitForValue(() => currentAccount(world), (me) => sessionIs(world, me, user), budget(world));
  if (!result.ok) {
    const said = await loginSays(world);
    throw friendly({
      message: `Signing in as "${handle}" (${user.username}) did not work${said ? `: the site says "${said}"` : `; the page is ${world.page.url()}`}.`,
      hint: 'Check the username and the password of this account in worldParameters.users of cucumber.js, that the account exists on the site and may sign in, and that it was not locked for a minute by three wrong passwords within 15 seconds.',
    });
  }
  sessions.set(key, (await world.context.cookies(siteRoot(world))).filter((c) => c.name === SESSION_COOKIE));
}

/** Revoke every login token the run met: the site's POST /users/logout with the token itself. */
async function revokeAll() {
  for (const [token, root] of tokensSeen) {
    const request = apiContexts.get(root) || await playwright.request.newContext({ ignoreHTTPSErrors: true });
    await request.post(`${root}/users/logout`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, data: '{}', failOnStatusCode: false }).catch(() => {});
    if (!apiContexts.has(root)) await request.dispose().catch(() => {});
  }
  tokensSeen.clear();
  managers.clear();
  sessions.clear();
}

/** The run's API clients, and their end. */
const managerContexts = {
  async dispose() {
    await revokeAll();
    for (const c of apiContexts.values()) await c.dispose().catch(() => {});
    apiContexts.clear();
  },
};

// ---------------------------------------------------------------------------
// The site's REST API, as the managing account
// ---------------------------------------------------------------------------

const managers = new Map();

/**
 * The managing account's login (worldParameters.manager: the administrator of the boards the features use), signed in
 * once a run through the site's REST API: { id, token, handle }.
 *
 * @param {object} world
 */
async function manager(world) {
  const handle = (world.parameters && world.parameters.manager) || 'owner';
  const key = siteRoot(world) + '|' + handle;
  if (managers.has(key)) return managers.get(key);
  const user = resolveUser(world, handle);
  const [status, answer] = await rest(world, 'POST', '/users/login', { username: user.username, password: user.password });
  if (status !== 200 || !answer || !answer.token) {
    throw friendly({ message: `The managing account "${handle}" could not sign in to the site's API (${status}${answer && answer.reason ? `: ${answer.reason}` : ''}).`, hint: 'worldParameters.manager names an account of the users registry: the administrator of the boards the features use, with its username and password.' });
  }
  keepToken(world, String(answer.token));
  const m = { id: String(answer.id), token: String(answer.token), handle };
  managers.set(key, m);
  return m;
}

/**
 * One call of the site's REST API as the managing account: its answer, or a friendly error that says what was asked.
 *
 * @param {object} world
 * @param {string} method
 * @param {string} route
 * @param {object|undefined} body
 * @param {string} what - what the call does, for the error ("make the card …")
 * @returns {Promise<*>}
 */
async function api(world, method, route, body, what) {
  const m = await manager(world);
  const [status, answer] = await rest(world, method, route, body, m.token);
  if (status < 200 || status >= 300) {
    throw friendly({
      message: `Could not ${what}: the site answered ${status}${answer && (answer.reason || answer.error) ? ` (${answer.reason || answer.error})` : ''}.`,
      hint: 'The managing account (worldParameters.manager) must administer the boards the features use.',
    });
  }
  return answer;
}

/** A board of the site by its title, as the managing account sees it: { id, title, slug }. */
async function findBoard(world, which) {
  const wanted = String(which || (world.parameters && world.parameters.board) || '').trim();
  const m = await manager(world);
  const boards = await api(world, 'GET', `/api/users/${m.id}/boards`, undefined, 'read the boards');
  const hit = (Array.isArray(boards) ? boards : []).find((b) => b && exactly(wanted).test(String(b.title)));
  if (!hit) throw friendly({ message: `No board "${wanted}" the managing account is on.`, hint: 'Name the board by its title, as the site lists it ("Webship site").' });
  const board = await api(world, 'GET', `/api/boards/${hit._id}`, undefined, `read the board ${hit.title}`);
  return { id: String(hit._id), title: String(hit.title), slug: String((board && board.slug) || 'board') };
}

/** The board's export, as the site's own Export makes it: its lists, its people and its cards (open ones only, by default). */
async function boardExport(world, board, query = 'archived=false&attachments=false&fields=board-header,labels,people') {
  return api(world, 'GET', `/api/boards/${board.id}/export?${query}`, undefined, `read the board ${board.title}`);
}

/** A list of a board by its title: its id. */
async function listNamed(world, board, title) {
  const lists = await api(world, 'GET', `/api/boards/${board.id}/lists`, undefined, `read the lists of ${board.title}`);
  const hit = (Array.isArray(lists) ? lists : []).find((l) => l && exactly(title).test(String(l.title)));
  if (!hit) throw friendly({ message: `No list "${title}" on ${board.title}.`, hint: `The lists of ${board.title}: ${(lists || []).map((l) => l.title).join(', ')}.` });
  return { id: String(hit._id), title: String(hit.title) };
}

/** The open cards of a board with this title. */
async function findCards(world, board, title) {
  const ex = await boardExport(world, board);
  return (Array.isArray(ex.cards) ? ex.cards : []).filter((c) => c && exactly(title).test(String(c.title)));
}

/** A card by its title, on a board (the scenario's, else the default one): { ...card, board }. */
async function cardNamed(world, which, boardTitle) {
  const board = await findBoard(world, boardTitle || state(world).board);
  const list = await findCards(world, board, which);
  if (!list.length) throw friendly({ message: `No card "${which}" on ${board.title}.`, hint: 'Name a card by its title; a scenario makes its own with Given there is a card "Webship test …".' });
  return { ...list[0], board };
}

/** A card a scenario made goes after it. */
function remember(world, id) {
  const s = state(world);
  s.made = s.made || new Set();
  s.made.add(String(id));
}

/** Remove a card for good, as the managing account, wherever its list is now (archived ones too). */
async function removeCard(world, id) {
  const card = await api(world, 'GET', `/api/cards/${id}`, undefined, `read the card ${id}`);
  if (!card || !card.boardId) return;
  await api(world, 'DELETE', `/api/boards/${card.boardId}/lists/${card.listId}/cards/${id}`, undefined, `remove the card "${card.title}"`);
}

/** Make a card in a list of a board, as the managing account; it goes after the scenario. */
async function makeCard(world, board, listTitle, title) {
  const m = await manager(world);
  const list = await listNamed(world, board, listTitle);
  const lanes = await api(world, 'GET', `/api/boards/${board.id}/swimlanes`, undefined, `read the swimlanes of ${board.title}`);
  const lane = (Array.isArray(lanes) ? lanes : [])[0];
  if (!lane) throw friendly({ message: `${board.title} has no swimlane to put a card in.`, hint: 'A board has its Default swimlane once it is made.' });
  const made = await api(world, 'POST', `/api/boards/${board.id}/lists/${list.id}/cards`, { title, description: '', authorId: m.id, swimlaneId: String(lane._id) }, `make the card "${title}" in ${list.title} of ${board.title}`);
  if (!made || !made._id) throw friendly({ message: `The card "${title}" was not made in ${board.title}.`, hint: 'The managing account must administer the board.' });
  remember(world, made._id);
  return { _id: String(made._id), title, listId: list.id, board };
}

/** The card the scenario opened, as the site has it now. */
async function cardNow(world) {
  const s = state(world);
  if (!s.card) throw friendly({ message: 'No card is open.', hint: 'Open one first: When I open the card "…".' });
  return api(world, 'GET', `/api/cards/${s.card}`, undefined, `read the card "${s.title}"`);
}

/** The card's panel, once it is open. */
function details(world) {
  return world.page.locator('.card-details').first();
}

/** Open a card on its own address and wait for its title in its panel. */
async function openCard(world, card) {
  const s = state(world);
  s.card = String(card._id);
  s.title = String(card.title);
  s.board = card.board ? card.board.title : s.board;
  await open(world, `/b/${card.board.id}/${card.board.slug}/${card._id}`);
  await actOrExplain('open the card', card.title, async () => {
    await details(world).locator('h2.card-details-title').filter({ hasText: exactly(card.title) }).first().waitFor({ state: 'visible', timeout: budget(world) });
  }, 'The card\'s panel did not show its title: the account must be one the board has.');
}

/** A part of the card's panel by its heading ("Creator", "Assignee", "List"). */
function item(world, title) {
  return details(world).locator('.card-details-item').filter({ has: world.page.locator('h3.card-details-item-title', { hasText: new RegExp('^\\s*' + escapeRegExp(title) + '\\b') }) }).first();
}

/** The popup the site opens over the page. */
function popup(world) {
  return world.page.locator('.pop-over').first();
}

/** Close the popup, and wait until it is gone. */
async function closePopup(world) {
  const box = popup(world);
  if (!(await box.isVisible().catch(() => false))) return;
  const close = box.locator('a.js-close-pop-over').first();
  if (await close.isVisible().catch(() => false)) await close.click(); else await world.page.keyboard.press('Escape');
  await box.waitFor({ state: 'hidden', timeout: budget(world) }).catch(() => {});
}

/** The name a member link of the site shows in its title: "Owner Test (owner) Admin" is Owner Test. */
function memberName(title) {
  return tidy(String(title || '').replace(/\s*\([^)]*\).*$/, ''));
}

module.exports = {
  SESSION_COOKIE,
  budget,
  escapeRegExp,
  words,
  exactly,
  tidy,
  actOrExplain,
  assertPresence,
  waitForValue,
  siteRoot,
  siteUrl,
  state,
  sessionToken,
  open,
  resolveUser,
  apiContext,
  keepToken,
  rest,
  currentAccount,
  sessionIs,
  currentUser,
  dropSession,
  submitLogin,
  loginSays,
  signInAs,
  revokeAll,
  managerContexts,
  manager,
  api,
  findBoard,
  boardExport,
  listNamed,
  findCards,
  cardNamed,
  remember,
  removeCard,
  makeCard,
  cardNow,
  details,
  openCard,
  item,
  popup,
  closePopup,
  memberName,
  friendly,
  smartSettle,
  gotoUrl,
  playwright,
};
