// utils/salaryHelper.js
// Path: unifost_hrms_backend/utils/salaryHelper.js

/**
 * Login time se attendance status decide karta hai
 * @param {string} loginTime - "HH:MM"
 * @returns {{ status: string, lateMinutes: number }}
 */
export function getStatusFromLoginTime(loginTime) {
  if (!loginTime) return { status: "absent", lateMinutes: 0 };

  const [h, m]       = loginTime.split(":").map(Number);
  const totalMin     = h * 60 + m;
  const ON_TIME      = 9 * 60 + 30;  // 9:30 AM
  const HALF_DAY     = 12 * 60;       // 12:00 PM

  if (totalMin <= ON_TIME)  return { status: "present",  lateMinutes: 0 };
  if (totalMin <= HALF_DAY) return { status: "late",     lateMinutes: totalMin - ON_TIME };
  return                           { status: "half-day", lateMinutes: 0 };
}

/**
 * KRA average se bonus/penalty decide karta hai
 * @param {number} avg
 * @returns {{ category: string, bonusPercent: number }}
 */
export function getKRABonus(avg) {
  if (avg >= 4.5) return { category: "Excellent", bonusPercent: 20 };
  if (avg >= 3.5) return { category: "Good",      bonusPercent: 10 };
  if (avg >= 2.5) return { category: "Average",   bonusPercent: 0  };
  return                  { category: "Poor",      bonusPercent: -10 };
}

/**
 * Monthly salary calculate karta hai
 * @param {{ salaryStructure: object, attendanceList: Array, kraBonus: number, totalWorkingDays: number }}
 */
export function calculateMonthlySalary({ salaryStructure, attendanceList, kraBonus = 0, totalWorkingDays }) {
  let presentDays = 0, halfDays = 0, absentDays = 0, lateDays = 0;

  const basicSalary = salaryStructure?.basic || 0;

  for (const att of attendanceList) {
    if      (att.status === "present")  presentDays++;
    else if (att.status === "half-day") halfDays++;
    else if (att.status === "late")   { lateDays++; presentDays++; }
    else if (att.status === "absent")   absentDays++;
    else if (att.status === "leave")    presentDays++; // Paid leave
  }

  const perDay        = basicSalary / totalWorkingDays;
  const effectiveDays = presentDays + halfDays * 0.5;
  const earned        = perDay * effectiveDays;

  // 30 min se zyada late = us din ka 10% cut (example logic)
  const lateDeductionDays = attendanceList.filter(
    (a) => a.status === "late" && (a.lateMinutes || 0) > 30
  ).length;
  const lateDeduction = lateDeductionDays * perDay * 0.1;

  const kraAmount   = (earned * kraBonus) / 100;
  
  // Gross Calculation
  const gross       = earned - lateDeduction + kraAmount + (salaryStructure?.hra || 0) + (salaryStructure?.specialAllowance || 0);

  // Deductions
  const pf   = salaryStructure?.pfContribution || Math.round(basicSalary * 0.12);
  const esic = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
  const tds  = Math.round(gross * 0.1); // Example 10% TDS

  return {
    basicSalary:      Math.round(basicSalary),
    earnedSalary:     Math.round(earned),
    hra:              Math.round(salaryStructure?.hra || 0),
    specialAllowance: Math.round(salaryStructure?.specialAllowance || 0),
    lateDeduction:    Math.round(lateDeduction),
    kraAmount:        Math.round(kraAmount),
    grossSalary:      Math.round(gross),
    presentDays,
    halfDays,
    absentDays,
    lateDays,
    totalWorkingDays,
    effectiveDays:    Math.round(effectiveDays * 10) / 10,
    perDaySalary:     Math.round(perDay),
    pf,
    esic,
    tds,
    totalDeductions:  pf + esic + tds,
    netSalary:        Math.round(gross - pf - esic - tds),
  };
}