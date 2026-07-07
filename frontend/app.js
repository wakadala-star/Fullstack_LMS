const API_URL = 'http://localhost:5000/api';

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const loginFormElement = document.getElementById('loginFormElement');
const registerFormElement = document.getElementById('registerFormElement');

const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');

const toast = document.getElementById('toast');

const showToast = (message, type = 'info') => {
  toast.textContent = message;
  toast.className = 'toast ' + type;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3000);
};

document.getElementById('showRegister').addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
});

document.getElementById('showLogin').addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
});

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePassword = (password) => {
  return password.length >= 6;
};

loginFormElement.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!validateEmail(email)) {
    loginError.textContent = 'Please enter a valid email';
    return;
  }

  if (!password) {
    loginError.textContent = 'Password is required';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      showToast('Failed to login. Check your credentials.', 'error');
      loginError.textContent = data.error || 'Login failed';
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    showToast('You have logged in successfully!', 'success');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);
  } catch (error) {
    showToast('Network error. Please try again.', 'error');
    loginError.textContent = 'Network error. Please try again.';
  }
});

registerFormElement.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerError.textContent = '';

  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;

  if (!name) {
    registerError.textContent = 'Name is required';
    return;
  }

  if (!validateEmail(email)) {
    registerError.textContent = 'Please enter a valid email';
    return;
  }

  if (!validatePassword(password)) {
    registerError.textContent = 'Password must be at least 6 characters';
    return;
  }

  if (password !== confirmPassword) {
    registerError.textContent = 'Passwords do not match';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      showToast('Registration failed. ' + (data.error || ''), 'error');
      registerError.textContent = data.error || 'Registration failed';
      return;
    }

    showToast('Account created successfully! Redirecting to login...', 'success');
    registerFormElement.reset();

    setTimeout(() => {
      registerForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
    }, 2000);
  } catch (error) {
    showToast('Network error. Please try again.', 'error');
    registerError.textContent = 'Network error. Please try again.';
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
});
