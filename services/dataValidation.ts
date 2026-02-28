import { EmployeeData, ValidationResult, ValidationError } from '../types';

/**
 * 驗證員工資料
 * @param data 員工資料陣列
 * @param historicalMaxValue 歷史最高派單價值 (用於判斷是否創新高)
 * @returns 驗證結果
 */
export const validateEmployeeData = (
    data: EmployeeData[],
    historicalMaxValue: number = 0
): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const infos: ValidationError[] = [];

    // 1. 檢查重複姓名
    const nameCount = new Map<string, number[]>();
    data.forEach((emp, index) => {
        const name = emp.name.trim();
        if (!name) return; // 空姓名稍後處理

        if (!nameCount.has(name)) {
            nameCount.set(name, []);
        }
        nameCount.get(name)!.push(index + 1);
    });

    nameCount.forEach((rows, name) => {
        if (rows.length > 1) {
            errors.push({
                type: 'error',
                row: rows[0],
                field: '行銷',
                employeeName: name,
                message: `姓名「${name}」重複出現在第 ${rows.join(', ')} 列`
            });
        }
    });

    // 2. 逐筆驗證
    data.forEach((emp, index) => {
        const rowNum = index + 1;

        // 必填欄位檢查 (姓名)
        if (!emp.name || emp.name.trim() === '') {
            errors.push({
                type: 'error',
                row: rowNum,
                field: '行銷',
                message: '姓名不可為空 (建議填入「員工 ' + rowNum + '」)'
            });
        }

        // 派成數 > 派單數 (溢單檢查)
        if (emp.todaySales > emp.todayLeads) {
            const overflow = emp.todaySales - emp.todayLeads;
            warnings.push({
                type: 'warning', // 降級為警告，觸發 DataInput 裡的互動式回溯
                row: rowNum,
                field: '派成數',
                employeeName: emp.name,
                message: `派成數 (${emp.todaySales}) 超過派單數 (${emp.todayLeads})`,
                overflowSales: overflow
            });
        }

        // 派單價值超越歷史新高
        if (historicalMaxValue > 0 && emp.avgOrderValue > historicalMaxValue) {
            infos.push({
                type: 'info',
                row: rowNum,
                field: '派單價值',
                employeeName: emp.name,
                message: `🎉 超越歷史新高! 派單價值 ${emp.avgOrderValue.toLocaleString()} 元 (歷史最高: ${historicalMaxValue.toLocaleString()} 元)`
            });
        }
    });

    // 彙總資訊
    if (errors.length === 0 && warnings.length === 0 && infos.length === 0) {
        infos.push({
            type: 'info',
            row: 0,
            field: '',
            message: `✅ 共 ${data.length} 筆資料,全部通過驗證`
        });
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        infos
    };
};
