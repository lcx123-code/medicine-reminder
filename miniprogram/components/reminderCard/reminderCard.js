// components/reminderCard/reminderCard.js
var dateUtil = require('../../utils/date');

Component({
  properties: {
    reminder: {
      type: Object,
      value: {}
    }
  },

  data: {
    timeText: ''
  },

  lifetimes: {
    ready: function () {
      var reminder = this.properties.reminder;
      if (reminder && reminder.timeStr) {
        this.setData({ timeText: reminder.timeStr });
      } else if (reminder && reminder.scheduledTime) {
        this.setData({ timeText: dateUtil.formatTime(reminder.scheduledTime) });
      }
    }
  },

  observers: {
    'reminder.scheduledTime': function (val) {
      var reminder = this.properties.reminder;
      if (reminder && reminder.timeStr) {
        this.setData({ timeText: reminder.timeStr });
      } else if (val) {
        this.setData({ timeText: dateUtil.formatTime(val) });
      }
    }
  },

  methods: {
    onTapTake: function () {
      this.triggerEvent('takeMedicine', { reminder: this.properties.reminder });
    },
    onTapAcknowledge: function () {
      this.triggerEvent('acknowledge', { reminder: this.properties.reminder });
    }
  }
});
