const toast = document.getElementById('toast');

const showToast = (message, type = 'info') => {
  toast.textContent = message;
  toast.className = 'toast ' + type;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3000);
};

const checkAuth = () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');

  if (!token || !user) {
    showToast('Please login first', 'error');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
    return null;
  }

  return JSON.parse(user);
};

const formatTime = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const loadDashboard = () => {
  const user = checkAuth();
  if (!user) return;

  document.getElementById('userName').textContent = user.name;
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();

  const loginTime = new Date();
  document.getElementById('loginTime').textContent = formatTime(loginTime);

  const expiryTime = new Date(loginTime.getTime() + 24 * 60 * 60 * 1000);
  document.getElementById('sessionExpiry').textContent = formatTime(expiryTime);

  showToast('Welcome back, ' + user.name + '!', 'success');
};

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showToast('Logged out successfully', 'info');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1000);
});

loadDashboard();
