function formatDate(date) {
  var d = new Date(date);
  var year = d.getFullYear();
  var month = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return year + '-' + month + '-' + day;
}

function formatTime(date) {
  if (!date) return '';
  var d = new Date(date);
  var bjHours = (d.getUTCHours() + 8) % 24;
  var hours = ('0' + bjHours).slice(-2);
  var minutes = ('0' + d.getUTCMinutes()).slice(-2);
  return hours + ':' + minutes;
}

module.exports = {
  formatDate: formatDate,
  formatTime: formatTime
};
