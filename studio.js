import { portfolioRequest, renderJournalText } from './journal-text.js';

const status = document.querySelector('#studio-status');
const signIn = document.querySelector('#studio-login');
const workspace = document.querySelector('#studio-workspace');
const loginForm = document.querySelector('#owner-form');
const password = document.querySelector('#studio-password');
const loginSubmit = document.querySelector('#login-submit');
const signOut = document.querySelector('#sign-out');
const draftList = document.querySelector('#draft-list');
const form = document.querySelector('#post-form');
const title = document.querySelector('#editor-post-title');
const body = document.querySelector('#editor-body');
const previewToggle = document.querySelector('#preview-post');
const preview = document.querySelector('#editor-preview');
const previewBody = document.querySelector('#editor-preview-body');
const publicLink = document.querySelector('#published-link');
const unpublish = form.querySelector('[data-action="unpublish"]');
const actions = [...form.querySelectorAll('[data-action]')];
const blank = { id: null, title: '', body: '', revision: 0, published_at: null };

let working = false;
let setup = false;
let drafts = [];
let current = blank;

function notice(message) {
  status.textContent = message;
  status.hidden = !message;
}

function dirty() {
  return title.value !== current.title || body.value !== current.body;
}

function canSwitch() {
  return !working && (!dirty() || confirm('Discard unsaved changes to this draft?'));
}

function renderDraftList() {
  draftList.replaceChildren(...drafts.map((draft) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const name = document.createElement('strong');
    const state = document.createElement('span');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(current.id === draft.id));
    name.textContent = draft.title || 'Untitled draft';
    state.textContent = draft.published_at ? 'Published' : 'Draft';
    button.append(name, state);
    button.addEventListener('click', () => {
      if (current.id !== draft.id && canSwitch()) openDraft(draft);
    });
    item.append(button);
    return item;
  }));
}

function openDraft(draft) {
  current = draft;
  title.value = draft.title;
  body.value = draft.body;
  unpublish.hidden = !draft.published_at;
  publicLink.hidden = !draft.published_at;
  publicLink.href = draft.published_at ? 'post.html?id=' + encodeURIComponent(draft.id) : 'blog.html';
  if (!preview.hidden) renderJournalText(body.value, previewBody);
  renderDraftList();
  notice('');
}

async function openStudio() {
  const session = await portfolioRequest('/api/session');
  setup = session.setupRequired;
  signIn.hidden = session.signedIn;
  workspace.hidden = !session.signedIn;
  signOut.hidden = !session.signedIn;
  if (session.signedIn) {
    ({ drafts } = await portfolioRequest('/api/drafts'));
    openDraft(drafts[0] || blank);
  } else {
    document.querySelector('#login-title').textContent = setup ? 'Set your studio password' : 'Sign in';
    document.querySelector('#login-help').textContent = setup
      ? 'Choose a password of at least 10 characters for this local writing studio.'
      : 'Enter your studio password to edit posts.';
    password.autocomplete = setup ? 'new-password' : 'current-password';
    loginSubmit.textContent = setup ? 'Set password and sign in' : 'Sign in';
    notice('');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (working) return;
  working = true;
  loginSubmit.disabled = true;
  try {
    await portfolioRequest('/api/session', { password: password.value, setup });
    password.value = '';
    await openStudio();
    title.focus();
  } catch (error) {
    notice(error.message);
  } finally {
    working = false;
    loginSubmit.disabled = false;
  }
});

signOut.addEventListener('click', async () => {
  if (!canSwitch()) return;
  working = true;
  try {
    await portfolioRequest('/api/session/end', {});
    openDraft(blank);
    await openStudio();
    password.focus();
  } catch (error) {
    notice(error.message);
  } finally {
    working = false;
  }
});

document.querySelector('#new-post').addEventListener('click', () => {
  if (canSwitch()) {
    openDraft(blank);
    title.focus();
  }
});

form.addEventListener('submit', (event) => event.preventDefault());
previewToggle.addEventListener('click', () => {
  preview.hidden = !preview.hidden;
  previewToggle.setAttribute('aria-expanded', String(!preview.hidden));
  if (!preview.hidden) renderJournalText(body.value, previewBody);
});
body.addEventListener('input', () => {
  if (!preview.hidden) renderJournalText(body.value, previewBody);
});

for (const button of actions) {
  button.addEventListener('click', async () => {
    if (working) return;
    const action = button.dataset.action;
    working = true;
    actions.forEach((control) => { control.disabled = true; });
    title.readOnly = true;
    body.readOnly = true;
    try {
      const { draft } = await portfolioRequest('/api/drafts', {
        id: current.id,
        revision: current.revision,
        action,
        title: title.value,
        body: body.value,
      });
      drafts = [draft, ...drafts.filter((item) => item.id !== draft.id)];
      openDraft(draft);
      notice(action === 'publish' ? 'Post published.' : action === 'unpublish' ? 'Post unpublished. Your draft is saved.' : 'Draft saved.');
    } catch (error) {
      notice(error.message);
    } finally {
      working = false;
      title.readOnly = false;
      body.readOnly = false;
      actions.forEach((control) => { control.disabled = false; });
    }
  });
}

window.addEventListener('beforeunload', (event) => {
  if (!workspace.hidden && dirty()) event.preventDefault();
});
openStudio().catch((error) => notice(error.message));

