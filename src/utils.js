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

class TextUtil {
  static FILTERING = [
    'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ',
    'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
    'ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ',
    '~', '!', '@', '`', '#', '$', '%', '^', '&', '*', '(', ')', '-', '='
  ]

  static escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // 정규 표현식 특수 문자 이스케이프
  }

  static filterText(text) {
    for (const f of this.FILTERING) {
      const escapedChar = this.escapeRegExp(f); // 특수 문자 이스케이프
      text = text.replace(new RegExp(escapedChar, 'g'), '');
    }

    return text.trim();
  }

  static toStringArray(text) {
    return text.split('\n').map(text => text.trim());
  }
}

module.exports = {
  DateUtil,
  TextUtil
};