// pages/addMedication/addMedication.js
var api = require('../../utils/api');
var dateUtil = require('../../utils/date');
var dosageUtil = require('../../utils/dosage');
var haptic = require('../../utils/haptic');

Page({
  data: {
    isEdit: false,
    medicationId: '',
    formData: {
      name: '',
      dosage: '',
      frequency: '',
      times: [],
      stock: '',
      stockUnit: '片',
      stockWarning: '10',
      stockEnabled: true,
      duration: 0,
      startDate: dateUtil.getToday(),
      notes: ''
    },
    frequencyOptions: ['每天1次', '每天2次', '每天3次', '每周1次', '每周2次', '每周3次'],
    stockUnitOptions: dosageUtil.COMMON_UNITS,
    durationOptions: ['长期', '7天', '14天', '21天', '30天', '自定义'],
    durationValues: [0, 7, 14, 21, 30, -1],
    durationText: '长期',
    hours: ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'],
    minutes: ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59'],
    hourIndex: 0,
    minuteIndex: 0,
    selectedHour: '',
    selectedMinute: ''
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({
        isEdit: true,
        medicationId: options.id
      });
      this.loadMedication(options.id);
      wx.setNavigationBarTitle({ title: '编辑药品' });
    } else {
      wx.setNavigationBarTitle({ title: '添加药品' });
    }
  },

  loadMedication: function (id) {
    var that = this;
    api.getMedications().then(function (res) {
      if (res.code === 0) {
        var medications = res.data;
        for (var i = 0; i < medications.length; i++) {
          if (medications[i]._id === id) {
            var med = medications[i];
            that.setData({
              formData: {
                name: med.name,
                dosage: med.dosage,
                frequency: med.frequency,
                times: med.times || [],
                stock: med.stock.toString(),
                stockUnit: med.stockUnit || '片',
                stockWarning: (med.stockWarning || 10).toString(),
                stockEnabled: med.stockEnabled !== false,
                duration: med.duration || 0,
                startDate: med.startDate || dateUtil.getToday(),
                notes: med.notes || ''
              },
              durationText: that.getDurationText(med.duration)
            });
            break;
          }
        }
      }
    });
  },

  getDurationText: function (duration) {
    if (duration === 0) return '长期';
    if (duration === 7) return '7天';
    if (duration === 14) return '14天';
    if (duration === 21) return '21天';
    if (duration === 30) return '30天';
    return duration + '天';
  },

  onInputName: function (e) {
    this.setData({ 'formData.name': e.detail.value });
  },

  onInputDosage: function (e) {
    this.setData({ 'formData.dosage': e.detail.value });
  },

  onSelectFrequency: function (e) {
    var index = e.detail.value;
    this.setData({ 'formData.frequency': this.data.frequencyOptions[index] });
  },

  onHourChange: function (e) {
    var index = e.detail.value;
    this.setData({
      hourIndex: index,
      selectedHour: this.data.hours[index]
    });
  },

  onMinuteChange: function (e) {
    var index = e.detail.value;
    this.setData({
      minuteIndex: index,
      selectedMinute: this.data.minutes[index]
    });
  },

  onConfirmTime: function () {
    var hour = this.data.selectedHour;
    var minute = this.data.selectedMinute;
    if (!hour || !minute) {
      wx.showToast({ title: '请选择时和分', icon: 'none' });
      return;
    }
    var time = hour + ':' + minute;
    var times = this.data.formData.times;
    if (times.indexOf(time) === -1) {
      times.push(time);
      times.sort();
      this.setData({
        'formData.times': times,
        selectedHour: '',
        selectedMinute: '',
        hourIndex: 0,
        minuteIndex: 0
      });
    } else {
      wx.showToast({ title: '时间已存在', icon: 'none' });
    }
  },

  onDeleteTime: function (e) {
    var index = e.currentTarget.dataset.index;
    var times = this.data.formData.times;
    times.splice(index, 1);
    this.setData({ 'formData.times': times });
  },

  onInputStock: function (e) {
    this.setData({ 'formData.stock': e.detail.value });
  },

  onSelectStockUnit: function (e) {
    var index = e.detail.value;
    this.setData({ 'formData.stockUnit': this.data.stockUnitOptions[index] });
  },

  onInputStockWarning: function (e) {
    this.setData({ 'formData.stockWarning': e.detail.value });
  },

  onToggleStock: function (e) {
    this.setData({ 'formData.stockEnabled': e.detail.value });
  },

  onSelectDuration: function (e) {
    var index = e.detail.value;
    var duration = this.data.durationValues[index];
    this.setData({
      'formData.duration': duration,
      durationText: this.data.durationOptions[index]
    });
  },

  onSelectStartDate: function (e) {
    this.setData({ 'formData.startDate': e.detail.value });
  },

  onInputNotes: function (e) {
    this.setData({ 'formData.notes': e.detail.value });
  },

  onSave: function () {
    var that = this;
    var formData = that.data.formData;
    haptic.light();

    // 验证表单
    if (!formData.name) {
      wx.showToast({ title: '请输入药品名称', icon: 'none' });
      return;
    }
    if (!formData.dosage) {
      wx.showToast({ title: '请输入剂量', icon: 'none' });
      return;
    }
    if (!formData.frequency) {
      wx.showToast({ title: '请选择频次', icon: 'none' });
      return;
    }
    if (formData.times.length === 0) {
      wx.showToast({ title: '请至少添加一个提醒时间', icon: 'none' });
      return;
    }

    // 构建提交数据
    var submitData = {
      name: formData.name,
      dosage: formData.dosage,
      frequency: formData.frequency,
      times: formData.times,
      stockEnabled: formData.stockEnabled,
      stock: formData.stockEnabled ? (parseFloat(formData.stock) || 0) : 0,
      stockUnit: formData.stockEnabled ? formData.stockUnit : '片',
      stockWarning: formData.stockEnabled ? (parseInt(formData.stockWarning) || 10) : 0,
      duration: formData.duration,
      startDate: formData.startDate,
      notes: formData.notes,
      timezoneOffset: new Date().getTimezoneOffset()
    };

    // 如果是自定义周期
    if (formData.duration === -1) {
      submitData.duration = parseInt(formData.customDuration) || 0;
    }

    var promise;
    if (that.data.isEdit) {
      submitData.id = that.data.medicationId;
      promise = api.updateMedication(submitData);
    } else {
      promise = api.addMedication(submitData);
    }

    promise.then(function (res) {
      if (res.code === 0) {
        haptic.heavy();
        wx.showToast({
          title: that.data.isEdit ? '更新成功' : '添加成功',
          icon: 'success'
        });
        // 添加/编辑成功后请求订阅消息授权
        that.requestSubscription();
        setTimeout(function () {
          wx.navigateBack();
        }, 1500);
      }
    }).catch(function (err) {
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    });
  },

  /**
   * 请求订阅消息授权
   * 添加/编辑药品成功后调用，让用户授权接收提醒通知
   */
  requestSubscription: function () {
    wx.requestSubscribeMessage({
      tmplIds: ['HBUcX64MIUMEnf-WPQiAuatrglxdIORe4Z03ZgNHGrg'],
      success: function (res) {
        console.log('订阅消息授权结果:', res);
      },
      fail: function (err) {
        console.log('订阅消息授权失败:', err);
      }
    });
  }
});
