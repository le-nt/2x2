
(async () => {
  const $ = id => document.getElementById(id);
  try {
    const me = await RB.page('Games');
    if (!me) return;

    const id = RB.param('id');
    const map = await RB.map(id);
    if (!map) throw Error('Choose a valid game.');

    $('PlaceName').textContent = map.name;
    document.title = map.name + ' - 2x2';

    const frame = $('PlayerFrame');
    frame.style.position = 'relative';

    $('GameCanvas').style.display = 'none';
    $('Loading').hidden = true;
    $('Loading').style.display = 'none';

    const player = document.createElement('iframe');
    player.title = map.name + ' game client';
    player.src = '/native-test.html?id=' + encodeURIComponent(id);
    player.allow = 'autoplay; fullscreen; gamepad';
    player.allowFullscreen = true;
    player.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#111;z-index:2';
    frame.appendChild(player);

    $('NativeStatus').textContent = 'Native player';
    $('RetryBtn')?.addEventListener('click', () => {
      player.src = '/native-test.html?id=' + encodeURIComponent(id)
        + '&reload=' + Date.now();
    });
    $('FullscreenBtn').addEventListener('click', async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.requestFullscreen();
    });
  } catch (error) {
    $('NativeStatus').textContent = error.message;
    console.error('[2x2 player]', error);
  }
})();
