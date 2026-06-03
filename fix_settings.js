const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

const t1 = `function onConfirm() {
  if (S.searchOpen) {
    if (S.focus === 'osk') pressOskKey();
    else if (S.focus === 'search-results') { const g = S.searchResults[S.searchResultIdx]; if (g) { closeSearch(); launchGame(g); } }
    return;
  }
  if (S.detailOpen) { launchGame(S.currentGame); return; }
  if (S.libraryOpen) { const g = S.games[S.libIdx]; if (g) { closeLibrary(); launchGame(g); } return; }
  switch (S.focus) {
    case 'topbar':
      if (S.topIdx === 0) openSearch(); else if (S.topIdx === 1) openSettings(); else if (S.topIdx === 2) openProfile(); break;`;

const r1 = `function onConfirm() {
  if (S.searchOpen) {
    if (S.focus === 'osk') pressOskKey();
    else if (S.focus === 'search-results') { const g = S.searchResults[S.searchResultIdx]; if (g) { closeSearch(); launchGame(g); } }
    return;
  }
  if (S.detailOpen) { launchGame(S.currentGame); return; }
  if (S.libraryOpen) { const g = S.games[S.libIdx]; if (g) { closeLibrary(); launchGame(g); } return; }
  switch (S.focus) {
    case 'topbar':
      if (S.topIdx === 0) openSearch(); else if (S.topIdx === 1) openSettings(); else if (S.topIdx === 2) openProfile(); break;
    case 'settings':
      if (S.settingsIdx === 0) closeSettings(); else if (S.settingsIdx === 1) toggleHideSteam(); else if (S.settingsIdx === 2) toggleDs3Fix(); break;
    case 'profile':
      if (S.profileIdx === 0) closeProfile(); break;`;

js = js.replace(t1, r1);
fs.writeFileSync('app.js', js);
