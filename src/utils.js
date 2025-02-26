class DateUtil {
  static getTodayKSTString() {
    const today = new Date(Date.now());
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  static getCurrentKSTTime() {
    const today = new Date(Date.now());
    const hour = String(today.getHours()).padStart(2, '0');
    const minute = String(today.getMinutes()).padStart(2, '0');
    const second = String(today.getSeconds()).padStart(2, '0');

    return `${hour}h${minute}m${second}s`;
  }
}

module.exports = {
  DateUtil
};