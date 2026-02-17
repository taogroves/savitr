(function() {
  var STORAGE_KEY = 'savitr-instructions-visible';

  function getStored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return v === null ? true : v === 'true';
    } catch (e) {
      return true;
    }
  }

  function setStored(visible) {
    try {
      localStorage.setItem(STORAGE_KEY, visible ? 'true' : 'false');
    } catch (e) {}
  }

  function apply(wrapper, visible) {
    var body = wrapper.querySelector('.instructions');
    var btn = wrapper.querySelector('.instructions-toggle');
    if (!body || !btn) return;
    body.hidden = !visible;
    btn.setAttribute('aria-expanded', visible ? 'true' : 'false');
    btn.textContent = visible ? 'Hide instructions' : 'Show instructions';
  }

  function init() {
    var wrapper = document.querySelector('.instructions-wrapper');
    if (!wrapper) return;

    var visible = getStored();
    apply(wrapper, visible);

    var btn = wrapper.querySelector('.instructions-toggle');
    if (btn) {
      btn.addEventListener('click', function() {
        visible = !visible;
        setStored(visible);
        apply(wrapper, visible);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
