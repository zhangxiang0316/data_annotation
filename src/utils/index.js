import {cloneDeep} from 'loadsh'

export const mergeData = (data, test) => {
    // 深拷贝 data，避免直接修改原数组
    let result = cloneDeep(data);
    const testColor = test.color;
    const testRange = test.range;

    // 查找与 test 相同颜色的条目
    const matchingEntries = result.filter(entry => entry.color === testColor);
    let hasOverlap = false;
    matchingEntries.forEach(entry => {
        const [entryStart, entryEnd] = entry.range;
        const [testStart, testEnd] = testRange;

        if (
            (entryStart <= testEnd && entryEnd >= testStart) || // 有重叠
            entryEnd + 1 === testStart || // 相邻
            testEnd + 1 === entryStart
        ) {
            // 合并 range
            entry.range = [
                Math.min(entryStart, testStart),
                Math.max(entryEnd, testEnd)
            ];
            hasOverlap = true;
        }
    });

    // 如果没有找到可合并的范围，将 test 作为新的条目加入
    if (!hasOverlap) {
        result.push(test);
    }

    // 遍历其他条目调整范围，避免与 test 直接重叠
    result = result.map(entry => {
        if (entry.color !== testColor) {
            const [entryStart, entryEnd] = entry.range;

            if (
                (entryStart <= testRange[1] && entryStart >= testRange[0]) || // test 包含 entry 的开始
                (entryEnd >= testRange[0] && entryEnd <= testRange[1]) || // test 包含 entry 的结束
                (testRange[0] <= entryStart && testRange[1] >= entryEnd) // test 完全覆盖 entry
            ) {
                // 重叠范围时，重新定义范围，避开 test
                if (entryStart < testRange[0]) {
                    // 保留左侧不重叠部分
                    return {...entry, range: [entryStart, testRange[0] - 1]};
                } else if (entryEnd > testRange[1]) {
                    // 保留右侧不重叠部分
                    return {...entry, range: [testRange[1] + 1, entryEnd]};
                }
                // 完全被 test 覆盖，删除该条目
                return null;
            }
        }
        return entry;
    }).filter(entry => entry !== null); // 过滤掉 null 的条目

    return result;
}


//判断是否在区间内
export const isValueInRanges = (value, ranges) => {
    // 遍历所有区间
    for (let range of ranges) {
        const [start, end] = range.range;
        // 检查值是否在当前区间内
        if (value >= start && value <= end) {
            return range.value;
        }
    }
    return ''; // 不在任何区间内
}