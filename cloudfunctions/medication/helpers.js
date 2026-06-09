function formatDate(date) {
  var d = new Date(date);
  var year = d.getFullYear();
  var month = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return year + '-' + month + '-' + day;
}

function calcScheduledTime(dateStr, timeStr, timezoneOffset) {
  return new Date(new Date(dateStr + 'T' + timeStr + ':00').getTime() + (timezoneOffset || 0) * 60 * 1000);
}

module.exports = {
  formatDate: formatDate,
  calcScheduledTime: calcScheduledTime
};
