<template>
  <a-layout style="height: 100%;width: 100%" v-loading="loading">
    <a-layout-header style="background: #3c66ed;padding: 10px 0">
      <div class="my-header">
        数据标注平台
      </div>
    </a-layout-header>
    <a-layout>
      <a-layout-sider style="padding: 15px;width: 260px">
        <a-form auto-label-width :model="formData" layout="vertical">
          <a-space>
            <a-upload
                :on-before-upload="beforeUpload"
                accept=".xlsx,.csv"
                action="/"
                :show-file-list="false"
                :auto-upload="false">
              <template #upload-button>
                <a-button type="primary">选择文件</a-button>
              </template>
            </a-upload>
            <a-button @click="downLoad">模版文件下载</a-button>
          </a-space>
          <div v-if="fileInfo.name" style="margin-top: 10px">{{ fileInfo.name }}</div>
          <a-form-item label="选择X轴">
            <a-select v-model="formData.x" :options="options" @change="changeX"/>
          </a-form-item>
          <a-form-item label="选择标注列">
            <a-select v-model="formData.y" :options="options"/>
          </a-form-item>
          <a-form-item label="联动">
            <a-switch v-model="formData.update" :unchecked-value="false" :checked-value="true" @change="updateAll"/>
          </a-form-item>
          <!--          <a-form-item label="时间轴">-->
          <!--            <a-range-picker-->
          <!--                showTime-->
          <!--                v-model="formData.time"-->
          <!--                :time-picker-props="{-->
          <!--                   defaultValue:['00:00:00','23:59:59']-->
          <!--                }"-->
          <!--                @change="timeChange"-->
          <!--                style=" width: 380px; "-->
          <!--            />-->
          <!--          </a-form-item>-->
          <div style="display: flex;flex-wrap: wrap;margin-top: 10px">
            <div v-for="item in problemOptions" :key="item.value" style="width: 50%;margin: 5px 0;cursor: pointer"
                 @click="setProblem(item)">
              <div style="display: flex">
                <div :style="{backgroundColor: item.color,width:'20px',height:'20px',borderRadius: '50%'}"></div>
                <div style="margin-left: 5px;color: #333">
                  {{ item.label }}
                </div>
              </div>
            </div>
          </div>
          <a-space style="margin-top: 20px">
            <a-button type="primary" @click="initChart">绘制</a-button>
            <a-button type="primary" @click="exportExcel">导出</a-button>
            <a-button type="primary" @click="back">后退</a-button>
          </a-space>
        </a-form>
      </a-layout-sider>
      <a-layout-content style="padding: 10px; height: calc(100vh - 60px);overflow-y: scroll">
        <div id="echarts" style="width: 100%;height: 400px"></div>
        <template v-for="item in allYData" :key="item.id">
          <div v-show="item.title!==formData.x" style="width: 100%; height: 300px;margin-top: 10px" :id="item.id"></div>
        </template>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>
<script setup>
import {onMounted, onUnmounted, reactive, ref} from "vue";
import * as echarts from 'echarts'
import * as XLSX from 'xlsx';
import {isValueInRanges, mergeData} from "@/utils/index.js";
import {cloneDeep, debounce, max, min, compact} from 'loadsh'
import {saveAs} from "file-saver";
import dayjs from 'dayjs'
import {Modal} from "@arco-design/web-vue";

let start = 0; // 初始 dataZoom 起点
let end = 100; // 初始 dataZoom 终点
const step = 5; // 每次移动的步长
const zoomStep = 5; // 缩放的步长
let visualMap = {}   // 可视化图
let xData = []       // x轴数据
let chart = ''       // echarts实例
let chartList = {} // echarts实例列表
let loading = ref(false)
let tableData = reactive([])    // 表格数据
let allYData = reactive([])  // echartsY轴图表数据
let options = ref([])  // x轴、y轴选项
let option = ref({})
let markAreaData = reactive([])// echarts配置项
let selectedRanges = ref([])// 选中的范围 合并后的
let currentRange = ref({})// 当前选中范围
let fileInfo = ref({})      // 文件信息
let baseZoom = reactive([
  {
    type: 'inside',
    start: 0,
    end: 100
  },
  {
    show: true,
    type: 'slider',
    bottom: 0,
    y: '90%',
    height: 30, //组件高度
    start: 0,
    end: 100,
  }
])  // 缩放配置
const problemOptions = reactive([
  {
    label: '1.泵堵塞',
    value: '1',
    color: '#63ed05',
  },
  {
    label: '2.供液不足',
    value: '2',
    color: '#da50ef',
  },
  {
    label: '3.吸入口堵塞',
    value: '3',
    color: '#3c51bc',
  },
  {
    label: '4.气体影响',
    value: '4',
    color: '#ed713d',
  },
  {
    label: '5.结垢',
    value: '5',
    color: '#e8bd6e',
  },
  {
    label: '6.砂卡',
    value: '6',
    color: '#eaa78b',
  },
  {
    label: '7.油管堵塞',
    value: '7',
    color: '#f3032f',
  },
  {
    label: '8.轴断',
    value: '8',
    color: '#87b867',
  },
  {
    label: '9.油管漏失',
    value: '9',
    color: '#0e33c8',
  },
  {
    label: '10.供电系统异常',
    value: '10',
    color: '#c214dd',
  },
])  // 问题类型选项
const formData = reactive({update: false}) // 表单数据
const history = ref([])
const changeX = () => {
  xData = tableData.map(item => {
    return item[formData.x]
  })
}
// 设置选中区域
const setVisualMap = () => {
  const pieces = selectedRanges.value.map(item => ({
    gte: item.range[0],
    lt: item.range[1],
    color: item.color,
  }));
  markAreaData = selectedRanges.value.map(item => {
    return [
      {
        name: problemOptions.find(option => option.value === item.value).label,
        xAxis: xData[item.range[0]],
        itemStyle: {
          color: item.color,
          opacity: 0.3
        },
        label: {
          position: 'inside',
          rotate: -90,
        },
      },
      {
        xAxis: xData[item.range[1]],
      },
    ]
  });
  const nowOption = chart.getOption();
  option.value.visualMap.pieces = [...pieces];
  option.value.dataZoom = nowOption.dataZoom;
  option.value.series[0]['markArea']['data'] = markAreaData
  // 更新图表
  console.log(option.value)
  chart.setOption(option.value, true);
  chart.dispatchAction({
    type: 'takeGlobalCursor', // 激活全局光标
    key: 'brush',             // 选中 brush 功能
    brushOption: {
      brushType: 'lineX'    // 设置默认的 Brush 类型为 lineX
    }
  });
  visualMap = option.value.visualMap
  updateAllChartVisualMap()
}
// 更新全部
const updateAll = () => {
  if (formData.update) {
    updateAllChartVisualMap()
    updateAllChartDataZoom()
  }
}
// 更新所有图表的visualMap
const updateAllChartVisualMap = () => {
  formData.update && allYData.forEach((item, index) => {
    setTimeout(() => {
      if (chartList[item.id]) {
        const option = chartList[item.id].getOption()
        option.series[0]['markArea']['data'] = markAreaData
        chartList[item.id].setOption(option, true);
      }
    }, index * 100)
  })
}
//更新所有图表的 dataZoom
const updateAllChartDataZoom = () => {
  formData.update && allYData.forEach((item, index) => {
    setTimeout(() => {
      chartList[item.id] && chartList[item.id].dispatchAction({
        type: 'dataZoom',
        start: start,
        end: end
      });
    }, index * 50)
  })
}
//后退
const back = () => {
  if (history.value.length) {
    selectedRanges.value = history.value[history.value.length - 1]
    history.value.splice(history.value.length - 1, 1)
    setVisualMap();
  }
}
// 更新选中范围
const updateSelectedRanges = () => {
  if (selectedRanges.value.length)
    history.value.push(cloneDeep(selectedRanges.value))
  selectedRanges.value = mergeData(selectedRanges.value, currentRange.value)
  setVisualMap()
  currentRange.value = {}
}
// 绘制图表
const initChart = () => {
  if (xData.length) {
    initAnnotationChart()
    initAllChart()
  }
}
//设置问题
const setProblem = (problem) => {
  if (!currentRange.value.range) {
    return
  }
  Modal.warning({
    title: '提示',
    hideCancel: false,
    closable: true,
    alignCenter: true,
    content: '将此段的数据标注为：' + problem.label + '？',
    cancelText: '取消',
    onOk: async () => {
      currentRange.value.value = problem.value
      currentRange.value.color = problemOptions.find(item => item.value === problem.value).color
      updateSelectedRanges()
    }
  })
}
// 初始化所有图表
const initAllChart = () => {
  allYData.filter(item => item.title !== formData.x).forEach((item, index) => {
    setTimeout(() => {
      if (!chartList[item.id]) {
        chartList[item.id] = echarts.init(document.getElementById(item.id))
      }
      const option = {
        title: {
          text: item.title,
        },
        tooltip: {
          trigger: 'axis',
        },
        grid: {
          top: '50px',
          left: '60px',
          right: '20px',
          bottom: '60px'
        },
        dataZoom: baseZoom.find(item => item.type !== 'inside'),
        xAxis: {
          type: 'category',
          data: xData,
        },
        yAxis: {
          type: 'value',
          min: item.min,
          max: item.max
        },
        visualMap: visualMap,
        series: [
          {
            name: '数据',
            type: 'line',
            data: item.data,
            markArea: {data: markAreaData},
          },
        ],
      }
      chartList[item.id].setOption(option, true)
    }, (index + 1) * 500)
  })
}
// 初始化标注图表
const initAnnotationChart = () => {
  option.value = {}
  if (!chart) {
    chart = echarts.init(document.getElementById('echarts'));
  }
  const yData = allYData.find(item => item.title === formData.y)
  // 配置项
  option.value = {
    title: {
      text: '标注  ' + formData.y,
    },
    grid: {
      top: '50px',
      left: '60px',
      right: '20px',
      bottom: '60px'
    },
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      type: 'category',
      data: xData,
    },
    yAxis: {
      type: 'value',
      min: yData.min,
      max: yData.max
    },
    dataZoom: baseZoom,
    series: [
      {
        name: '数据',
        type: 'line',
        data: yData.data,
        markArea: {data: markAreaData},
      },
    ],
    visualMap: visualMap,
    brush: {
      toolbox: ['lineX', 'clear'],
      xAxisIndex: 0,
      transformable: true,
      brushStyle: {
        borderWidth: 1,
        color: 'rgba(35,95,214,0.3)',
        borderColor: 'rgba(120,140,180,0.8)',
      },
    },
    toolbox: {
      feature: {
        brush: {
          type: ['lineX', 'clear'],
        },
      },
    },
  };
  // 设置配置项
  chart.setOption(option.value, true);
  setTimeout(() => {
    chart.dispatchAction({
      type: 'takeGlobalCursor', // 激活全局光标
      key: 'brush',             // 选中 brush 功能
      brushOption: {
        brushType: 'lineX'      // 设置默认的 Brush 类型为 lineX
      }
    });
  }, 200);
  chart.on('brushSelected', (params) => {
    // 安全检查 params.batch 和 areas 是否存在
    if (
        params.batch &&
        params.batch[0] &&
        params.batch[0].areas &&
        params.batch[0].areas.length > 0
    ) {
      const area = params.batch[0].areas[0];
      if (area.coordRange) {
        currentRange.value = {
          range: area.coordRange,
        }
      }
    }
  });
  chart.on('dataZoom', debounce(() => {
    baseZoom = chart.getOption().dataZoom
    start = baseZoom[0].start;
    end = baseZoom[0].end;
    updateAllChartDataZoom()
  }, 300));
  // 监听键盘事件
  document.addEventListener('keydown', (event) => {
    if (event.shiftKey) {
      // Shift + 左右键：缩放范围
      if (event.key === 'ArrowLeft') {
        // 放大范围（减少显示的数据量）
        start = Math.min(start + zoomStep / 2, end - 1);
        end = Math.max(end - zoomStep / 2, start + 1);
      } else if (event.key === 'ArrowRight') {
        // 缩小范围（增加显示的数据量）
        start = Math.max(0, start - zoomStep / 2);
        end = Math.min(100, end + zoomStep / 2);
      }
    } else if (event.key === 'ArrowLeft') {
      // 左箭头按下
      start = Math.max(0, start - step);
      end = Math.max(start + 1, end - step);
    } else if (event.key === 'ArrowRight') {
      // 右箭头按下
      start = Math.min(100 - (end - start), start + step);
      end = Math.min(100, end + step);
    }
    // 更新 dataZoom
    chart.dispatchAction({
      type: 'dataZoom',
      start: start,
      end: end
    });
  });
};
//导出
const exportExcel = () => {
  if (!fileInfo.value.name) {
    return
  }
  console.log('导出开始', new Date().getTime())
  const data = tableData.map((item, index) => {
    return {
      ...item,
      'problem': isValueInRanges(index, selectedRanges.value),
    }
  });
  console.log('数据封装完成', new Date().getTime())
  const worksheet = XLSX.utils.json_to_sheet(data);
  console.log('转换worksheet完成', new Date().getTime())
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });
  console.log('写入execl完成', new Date().getTime())
  const blob = new Blob([excelBuffer], {type: "application/octet-stream"});
  saveAs(blob, `${dayjs(new Date()).format('YYYY/MM/DD HH:mm:ss')}_已标注_${fileInfo.value.name}`);
}
//下载模板
const downLoad = async () => {
  const attachmentUrl = "./template/template.xlsx";
  const link = document.createElement("a");
  link.href = attachmentUrl;
  link.download = "template.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
//选择文件
const beforeUpload = (file) => {
  if (allYData.length) {
    allYData.forEach(item => {
      if (chartList[item.id]) {
        chartList[item.id].dispose()
      }
    })
    if (chart)
      chart.dispose()
    allYData = []
    chartList = {}
    chart = null
  }
  let index = 0
  options.value = []
  fileInfo.value = file
  const reader = new FileReader();
  loading.value = true
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const time1 = new Date().getTime()
    console.log('读取文件开始', time1)
    const workbook = XLSX.read(data, {type: 'array', cellDates: true, dateNF: "YYYY-MM-DD HH:mm:ss"});
    const time2 = new Date().getTime()
    console.log('读取文件完成', time2);
    console.log('用时', time2 - time1)
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    let jsonData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // 不解析为原始值
      header: 1, // 保留所有行，包括表头
      defval: "", // 默认值为空字符串
    });
    const time3 = new Date().getTime()
    console.log('转json完成', time3)
    console.log('用时', time3 - time2)
    const headers = jsonData[0]; // 获取表头
    tableData = jsonData.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] !== undefined ? row[index] : ""; // 显式保留空列
      });
      return obj;
    });
    const time4 = new Date().getTime()
    console.log('转table完成', time4)
    console.log('用时', time4 - time3)
    const itemData = tableData[0]
    visualMap = {
      show: false,
      type: 'piecewise',
      dimension: 0,
      outOfRange: {
        color: '#333', // 超出范围的颜色
      },
      pieces: [
        {
          gt: 0,
          lte: tableData.length - 1,
          color: '#333',
        }
      ],
    }
    for (let item in itemData) {
      if (!(item === 'device_code' || item === 'data_time' || item === 'problem')) {
        index++
        const yData = compact(tableData.map(json => json[item])).map(Number)
        //找出 yData最大最小值
        const yMax = max(yData)
        const yMin = min(yData)
        allYData.push({
          id: `chat_id_${index}`,
          title: item,
          data: yData,
          min: yMin,
          max: yMax
        })
        options.value.push({
          label: item,
          value: item,
        })
      }
      // 已有数据反显
      if (item === 'problem') {
        const list = [];
        let currentProblem = '';
        let currentRange = {gte: '', lt: '', color: ''};
        const finalizeCurrentRange = () => {
          if (currentRange.gte !== '') {
            list.push(currentRange);
            selectedRanges.value.push({
              value: currentProblem,
              color: currentRange.color,
              range: [currentRange.gte, currentRange.lt],
            });
            currentRange = {gte: '', lt: '', color: ''};
          }
        };
        for (let i = 0; i < tableData.length; i++) {
          const problemDescription = tableData[i]['problem'];
          if (problemDescription) {
            if (currentProblem !== problemDescription) {
              finalizeCurrentRange();
              currentProblem = problemDescription;
              currentRange = {
                gte: i,
                lt: i,
                color: problemOptions.find(option => option.value === problemDescription).color,
              };
            } else {
              currentRange.lt = i;
            }
          } else {
            finalizeCurrentRange();
          }
        }
        finalizeCurrentRange();
        visualMap = {
          show: false,
          type: 'piecewise',
          dimension: 0,
          outOfRange: {
            color: '#333', // 超出范围的颜色
          },
          pieces: list,
        };
      }
    }
    const time5 = new Date().getTime()
    console.log('数据封装完成', time5)
    console.log('用时', time5 - time4)
    formData.x = 'date_time'
    xData = tableData.map(item => {
      return item[formData.x]
    })
    markAreaData = selectedRanges.value.map(item => {
      return [
        {
          name: problemOptions.find(option => option.value === item.value).label,
          xAxis: xData[item.range[0]],
          itemStyle: {
            color: item.color,
            opacity: 0.3
          },
        },
        {
          xAxis: xData[item.range[1]],
        },
      ]
    });
    formData.y = options.value[0].value
    loading.value = false
    baseZoom = [
      {
        type: 'inside',
        start: 0,
        end: 100
      },
      {
        show: true,
        type: 'slider',
        bottom: 0,
        y: '90%',
        height: 30, //组件高度
        start: 0,
        end: 100,
      }
    ]
  };
  reader.readAsArrayBuffer(file);
  return true
}
//监听窗口变化
onMounted(() => {
  window.addEventListener('resize', resizeChart)
})
//监听窗口变化
onUnmounted(() => {
  window.removeEventListener('resize', resizeChart)
})
// 监听窗口变化
const resizeChart = debounce(() => {
  chart && chart.resize()
  allYData.length && allYData.forEach((item, index) => {
    setTimeout(() => {
      chartList[item.id] && chartList[item.id].resize()
    }, (index + 1) * 50)
  })
}, 200)
</script>

<style scoped>
.my-header {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  color: white
}

:deep(.arco-form-item-layout-vertical > .arco-form-item-label-col) {
  margin-bottom: 0;
}

:deep(.arco-form-item) {
  margin-bottom: 10px;
}


</style>