/**
 * JADEX Portfolio — script.js
 * Production-ready JavaScript — No framework dependencies
 *
 * Modules:
 *  1. Shader animation (WebGL)
 *  2. Typing animation
 *  3. Scroll reveal (IntersectionObserver)
 *  4. Theme toggle (dark / light)
 *  5. Navbar scroll behaviour
 *  6. Mobile menu
 *  7. Smooth anchor scrolling
 *  8. Performance: Page Visibility API pause
 */

'use strict';

/* ============================================================
   1. WEBGL SHADER BACKGROUND ANIMATION
   ============================================================ */
function initShader() {
  const canvas = document.getElementById('shader-canvas');
  if (!canvas) return;

  /* Sync the WebGL drawing-buffer size with CSS layout size */
  function syncSize() {
    const w = canvas.clientWidth  || 1280;
    const h = canvas.clientHeight || 720;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
    }
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(syncSize).observe(canvas);
  }
  syncSize();

  const gl =
    canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl');

  if (!gl) {
    /* No WebGL support — shader bg silently absent */
    console.warn('JADEX: WebGL not supported. Shader background disabled.');
    return;
  }

  /* Vertex shader — full-screen triangle strip */
  const VS = `
    attribute vec2 a_position;
    varying   vec2 v_texCoord;

    void main() {
      v_texCoord  = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  /* Fragment shader — animated flowing gradient */
  const FS = `
    precision highp float;

    uniform float u_time;
    uniform vec2  u_resolution;
    uniform vec2  u_mouse;

    void main() {
      vec2 uv    = gl_FragCoord.xy / u_resolution.xy;
      vec2 mouse = u_mouse        / u_resolution;

      /* Flowing sine/cosine waves */
      float wave1 = sin(uv.x * 2.0 + u_time * 0.5) * 0.5 + 0.5;
      float wave2 = cos(uv.y * 3.0 - u_time * 0.3) * 0.5 + 0.5;

      /* Palette */
      vec3 baseColor  = vec3(0.04, 0.05, 0.06); /* #0a0d0f — dark surface  */
      vec3 cyanAccent = vec3(0.0,  0.94, 1.0);  /* #00f0ff — primary cyan  */
      vec3 blueAccent = vec3(0.0,  0.47, 1.0);  /* #0078ff — electric blue */

      /* Subtle pulsing intensity */
      float pulse = sin(u_time * 0.2) * 0.1 + 0.1;

      vec3 colour = mix(baseColor, cyanAccent, wave1 * pulse);
      colour      = mix(colour,    blueAccent, wave2 * pulse * 0.5);

      /* Mouse-reactive glow */
      float dist = distance(uv, mouse);
      float glow = smoothstep(0.4, 0.0, dist) * 0.15;
      colour += cyanAccent * glow;

      gl_FragColor = vec4(colour, 1.0);
    }
  `;

  /* ── Compile a shader ── */
  function compileShader(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('JADEX shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compileShader(gl.VERTEX_SHADER,   VS);
  const fs = compileShader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('JADEX shader link error:', gl.getProgramInfoLog(prog));
    return;
  }

  gl.useProgram(prog);

  /* Full-screen quad (triangle strip) */
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]),
    gl.STATIC_DRAW
  );

  const posAttr = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(posAttr);
  gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

  /* Uniform locations */
  const uTime  = gl.getUniformLocation(prog, 'u_time');
  const uRes   = gl.getUniformLocation(prog, 'u_resolution');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');

  /* Mouse tracking (pixel space, ShaderToy convention — y flipped) */
  let mouse = { x: canvas.width / 2, y: canvas.height / 2 };

  window.addEventListener('mousemove', function (e) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      mouse.x = ((e.clientX - rect.left) / rect.width)  * canvas.width;
      mouse.y = (1.0 - (e.clientY - rect.top) / rect.height) * canvas.height;
    }
  }, { passive: true });

  /* Animation loop with Page Visibility pause */
  let paused = false;
  let rafId  = null;

  document.addEventListener('visibilitychange', function () {
    paused = document.hidden;
    if (!paused && !rafId) {
      rafId = requestAnimationFrame(render);
    }
  });

  function render(t) {
    if (paused) {
      rafId = null;
      return;
    }

    /* Re-sync size if ResizeObserver isn't available */
    if (typeof ResizeObserver === 'undefined') syncSize();

    gl.viewport(0, 0, canvas.width, canvas.height);

    if (uTime)  gl.uniform1f(uTime,  t * 0.001);
    if (uRes)   gl.uniform2f(uRes,   canvas.width, canvas.height);
    if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    rafId = requestAnimationFrame(render);
  }

  rafId = requestAnimationFrame(render);
}

/* ============================================================
   2. TYPING ANIMATION — defined at bottom of file (section 11)
   ============================================================ */

/* ============================================================
   3. SCROLL REVEAL (IntersectionObserver)
   ============================================================ */
function initScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;

  /* If the browser doesn't support IntersectionObserver,
     show everything immediately */
  if (!('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) {
      el.classList.add('active');
    });
    return;
  }

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          /* Once revealed, stop observing for performance */
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  revealEls.forEach(function (el) {
    observer.observe(el);
  });
}

/* ============================================================
   4. THEME TOGGLE (Dark ↔ Light)
   ============================================================ */
function initThemeToggle() {
  const btn  = document.getElementById('theme-toggle');
  const html = document.documentElement;
  if (!btn) return;

  const icon = btn.querySelector('.material-symbols-outlined');

  /* Determine initial theme:
     Priority → localStorage → OS preference → default dark */
  function applyTheme(theme) {
    if (theme === 'light') {
      html.classList.remove('dark');
      html.classList.add('light');
      if (icon) icon.textContent = 'light_mode';
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
      if (icon) icon.textContent = 'dark_mode';
    }
  }

  const saved = localStorage.getItem('jadex-theme');
  if (saved) {
    applyTheme(saved);
  } else {
    /* Respect OS colour scheme if no saved preference */
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'dark'); /* default dark per brief */
  }

  btn.addEventListener('click', function () {
    const isDark = html.classList.contains('dark');
    const next   = isDark ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('jadex-theme', next);
  });

  /* Listen for OS theme changes */
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!localStorage.getItem('jadex-theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

/* ============================================================
   5. NAVBAR SCROLL BEHAVIOUR
   ============================================================ */
function initNavbarScroll() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  let ticking = false;

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(function () {
        if (window.scrollY > 50) {
          nav.classList.add('scrolled');
        } else {
          nav.classList.remove('scrolled');
        }
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  /* Run once on init to set correct state */
  onScroll();
}

/* ============================================================
   6. MOBILE MENU TOGGLE
   ============================================================ */
function initMobileMenu() {
  const btn  = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;

  function openMenu() {
    menu.classList.add('open');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-label', 'Close navigation menu');
    /* Trap focus inside menu — basic implementation */
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    menu.classList.remove('open');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-label', 'Open navigation menu');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', function () {
    const isOpen = menu.classList.contains('open');
    isOpen ? closeMenu() : openMenu();
  });

  /* Close when a link is clicked */
  menu.querySelectorAll('.mobile-nav-link').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  /* Close on Escape key */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) {
      closeMenu();
      btn.focus();
    }
  });

  /* Close when clicking outside the nav */
  document.addEventListener('click', function (e) {
    const nav = document.getElementById('main-nav');
    if (nav && !nav.contains(e.target) && menu.classList.contains('open')) {
      closeMenu();
    }
  });

  /* Close on resize to desktop breakpoint */
  const mq = window.matchMedia('(min-width: 768px)');
  mq.addEventListener('change', function (e) {
    if (e.matches) closeMenu();
  });
}

/* ============================================================
   7. SMOOTH ANCHOR SCROLLING
   Complements CSS scroll-behavior for older browsers & offsets
   ============================================================ */
function initSmoothScroll() {
  const NAV_HEIGHT = 80; /* matches .main-nav height */

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();

      const top =
        target.getBoundingClientRect().top +
        window.scrollY -
        NAV_HEIGHT;

      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });
}

/* ============================================================
   8. ACTIVE NAV LINK HIGHLIGHT (scroll-spy)
   ============================================================ */
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navLinks.forEach(function (link) {
            link.classList.toggle(
              'nav-link--active',
              link.getAttribute('href') === '#' + id
            );
          });
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
  );

  sections.forEach(function (section) {
    observer.observe(section);
  });
}

/* ============================================================
   INITIALISE ALL MODULES
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  initShader();
  initTyping();
  initScrollReveal();
  initThemeToggle();
  initNavbarScroll();
  initMobileMenu();
  initSmoothScroll();
  initScrollSpy();
});

/* ============================================================
   9. IMAGE SLIDESHOW
   ============================================================ */
function initSlideshow() {
  const track     = document.getElementById('slideshow-track');
  const viewport  = document.getElementById('slideshow-viewport');
  const dotsWrap  = document.getElementById('slide-dots');
  const prevBtn   = document.getElementById('slide-prev');
  const nextBtn   = document.getElementById('slide-next');

  if (!track || !dotsWrap || !prevBtn || !nextBtn) return;

  const slides    = Array.from(track.querySelectorAll('.slide'));
  const total     = slides.length;
  if (total === 0) return;

  let current     = 0;
  let autoId      = null;
  let isAnimating = false;

  /* ── Build dot buttons ── */
  slides.forEach(function (_, i) {
    const dot = document.createElement('button');
    dot.className   = 'slide-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
    dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    dot.addEventListener('click', function () { goTo(i); });
    dotsWrap.appendChild(dot);
  });

  function getDots() {
    return Array.from(dotsWrap.querySelectorAll('.slide-dot'));
  }

  function updateDots(idx) {
    getDots().forEach(function (dot, i) {
      dot.classList.toggle('active', i === idx);
      dot.setAttribute('aria-selected', i === idx ? 'true' : 'false');
    });
  }

  function goTo(idx) {
    if (isAnimating) return;
    isAnimating = true;
    current = (idx + total) % total;
    track.style.transform = 'translateX(-' + (current * 100) + '%)';
    updateDots(current);
    setTimeout(function () { isAnimating = false; }, 580);
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  prevBtn.addEventListener('click', function () { resetAuto(); prev(); });
  nextBtn.addEventListener('click', function () { resetAuto(); next(); });

  /* ── Auto-advance every 5 s ── */
  function startAuto() {
    autoId = setInterval(next, 5000);
  }
  function stopAuto()  { clearInterval(autoId); autoId = null; }
  function resetAuto() { stopAuto(); startAuto(); }

  startAuto();

  /* Pause on hover / focus */
  if (viewport) {
    viewport.addEventListener('mouseenter',  stopAuto,  { passive: true });
    viewport.addEventListener('mouseleave',  startAuto, { passive: true });
    viewport.addEventListener('focusin',     stopAuto,  { passive: true });
    viewport.addEventListener('focusout',    startAuto, { passive: true });
  }

  /* Pause while tab is hidden */
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stopAuto() : startAuto();
  });

  /* Keyboard navigation when focus is inside slideshow */
  document.addEventListener('keydown', function (e) {
    const active = document.activeElement;
    if (!track.closest('.slideshow-wrap').contains(active) && active !== prevBtn && active !== nextBtn) return;
    if (e.key === 'ArrowLeft')  { resetAuto(); prev(); }
    if (e.key === 'ArrowRight') { resetAuto(); next(); }
  });

  /* Touch / swipe support */
  var touchStartX = null;
  track.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  track.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) < 40) return;
    resetAuto();
    dx < 0 ? next() : prev();
  }, { passive: true });
}

/* ============================================================
   10. CONTACT FORM (AJAX — no page redirect)
   ============================================================ */
function initContactForm() {
  var form       = document.getElementById('contact-form');
  var submitBtn  = document.getElementById('form-submit-btn');
  var feedback   = document.getElementById('form-feedback');
  if (!form || !submitBtn || !feedback) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    /* Basic client-side validation */
    var name    = form.querySelector('#cf-name');
    var email   = form.querySelector('#cf-email');
    var message = form.querySelector('#cf-message');
    var invalid = false;

    [name, email, message].forEach(function (el) {
      el.style.borderColor = '';
      if (!el.value.trim()) {
        el.style.borderColor = 'var(--error)';
        invalid = true;
      }
    });

    if (invalid) {
      showFeedback('error', 'Please fill in all fields before sending.');
      return;
    }

    /* Loading state */
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    clearFeedback();

    var formData = new FormData(form);

    fetch('https://formsubmit.co/ajax/asjay2010@gmail.com', {
      method:  'POST',
      body:    formData,
      headers: { 'Accept': 'application/json' }
    })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;

      if (data.success === 'true' || data.success === true) {
        showFeedback('success', '✓ Message sent! Jerry will get back to you shortly.');
        form.reset();
        form.querySelectorAll('.form-input').forEach(function (el) {
          el.style.borderColor = '';
        });
      } else {
        throw new Error('Submission failed');
      }
    })
    .catch(function () {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      showFeedback('error', 'Something went wrong. Try emailing asjay2010@gmail.com directly.');
    });
  });

  function showFeedback(type, message) {
    feedback.className  = 'form-feedback ' + type;
    feedback.textContent = message;
  }

  function clearFeedback() {
    feedback.className  = 'form-feedback';
    feedback.textContent = '';
  }
}

/* ============================================================
   11. FOOTER YEAR
   ============================================================ */
function initFooterYear() {
  var el = document.getElementById('footer-year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ============================================================
   UPDATE TYPING PHRASES — merged from both portfolios
   ============================================================ */
function initTyping() {
  var el = document.getElementById('typing-text');
  if (!el) return;

  var phrases = [
    'Build High-Converting Websites.',
    'Engineer Custom WordPress Plugins.',
    'Design Premium UI/UX Experiences.',
    'Integrate APIs Seamlessly.',
    'Create Platforms That Generate Revenue.'
  ];

  var phraseIdx  = 0;
  var letterIdx  = 0;
  var isDeleting = false;
  var timer      = null;

  function tick() {
    var phrase = phrases[phraseIdx];

    if (isDeleting) {
      letterIdx--;
      el.textContent = phrase.substring(0, letterIdx);
    } else {
      letterIdx++;
      el.textContent = phrase.substring(0, letterIdx);
    }

    var delay = isDeleting ? 45 : 90;

    if (!isDeleting && letterIdx === phrase.length) {
      delay      = 2200;
      isDeleting = true;
    } else if (isDeleting && letterIdx === 0) {
      isDeleting = false;
      phraseIdx  = (phraseIdx + 1) % phrases.length;
      delay      = 450;
    }

    timer = setTimeout(tick, delay);
  }

  timer = setTimeout(tick, 800);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearTimeout(timer);
    } else {
      timer = setTimeout(tick, 200);
    }
  });
}

/* ============================================================
   RE-INITIALISE ON DOM READY (append to existing DOMContentLoaded)
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  initSlideshow();
  initContactForm();
  initFooterYear();
});
