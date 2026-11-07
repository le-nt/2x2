(async () => {
  const status = document.getElementById('LaunchStatus');
  try {
    const user = await RB.page('Games');
    if (!user) return;
    const id = RB.param('id'), map = await RB.map(id);
    if (!map) throw new Error('Unknown place. Choose a game from the Games page.');
    document.getElementById('PlaceName').textContent = 'Play ' + map.name;
    const launch = await RB.api('native-launch?id=' + encodeURIComponent(id));
    const target = new URL(launch.url);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Invalid launch URL.');
    status.textContent = 'Your game opens in the native web client. Sign in to the game service if prompted; its account is currently separate from your website account.';
    const link = document.createElement('a');
    link.className = 'Button Big'; link.href = target.href; link.textContent = 'Enter Game';
    document.getElementById('LaunchAction').append(link);
  } catch (error) { status.textContent = error.message; }
})();
