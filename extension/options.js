document.querySelector('#logout').onclick=async()=>{
  await chrome.storage.session.remove('grAuthKey');
  document.querySelector('#status').textContent='Доступ заблокирован. При следующем запросе потребуется пароль.';
};
