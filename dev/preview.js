// Use production markup and scripts; only the native bridge is mocked.
(async () => {
  const frame = document.getElementById('widget');
  const response = await fetch('../src/index.html');
  if (!response.ok) throw new Error('Unable to load the application preview');
  let markup = await response.text();
  markup = markup.replace('<head>', '<head><base href="' + new URL('../src/', location.href).href + '">');
  markup = markup.replace('<script src="themes.js">', '<script src="../dev/preview-mock.js"></script><script src="themes.js">');
  frame.srcdoc = markup;
  document.getElementById('size').addEventListener('change', (event) => {
    const [width, height] = event.target.value.split(',');
    frame.style.width = width + 'px';
    frame.style.height = height + 'px';
  });
})();
