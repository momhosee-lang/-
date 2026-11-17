(() => {
  'use strict';

  const STORAGE_KEY = 'rahbar-shahid-attendance-v1';
  const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const DAY_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  const fa = new Intl.NumberFormat('fa-IR');
  let state = loadState();
  let selectedDate = new Date();
  let activePage = 'dashboard';
  let toastTimer;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const copyDate = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const persianDate = (date, options = {}) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', options).format(date);
  const safeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { members: Array.isArray(parsed.members) ? parsed.members : [], attendance: parsed.attendance && typeof parsed.attendance === 'object' ? parsed.attendance : {} };
    } catch (error) {
      console.warn('Could not read saved attendance data.', error);
      return { members: [], attendance: {} };
    }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { notify('ذخیره‌سازی انجام نشد؛ فضای دستگاه را بررسی کنید.'); console.error(error); }
  }
  function notify(message) {
    const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }
  function saturdayOf(date) {
    const result = copyDate(date);
    result.setDate(result.getDate() - ((result.getDay() + 1) % 7));
    return result;
  }
  function weekDates(anchor = selectedDate) {
    const start = saturdayOf(anchor);
    return DAYS.map((_, index) => { const day = copyDate(start); day.setDate(start.getDate() + index); return day; });
  }
  function weekRangeText() {
    const dates = weekDates();
    return `${persianDate(dates[0], {day:'numeric', month:'long'})} تا ${persianDate(dates[6], {day:'numeric', month:'long', year:'numeric'})}`;
  }
  function memberStatus(memberId, date) { return state.attendance[dateKey(date)]?.[memberId] || ''; }
  function dayCounts(date) {
    const values = state.members.map(member => memberStatus(member.id, date));
    return { present: values.filter(value => value === 'present').length, absent: values.filter(value => value === 'absent').length, pending: values.filter(value => !value).length };
  }
  function dayName(date) { return DAYS[(date.getDay() + 1) % 7]; }
  function updateWeekLabels() {
    const text = weekRangeText(); ['#week-label', '#week-label-att', '#week-label-report'].forEach(selector => { $(selector).textContent = text; });
  }
  function renderDashboard() {
    const today = new Date(); const counts = dayCounts(today); const total = state.members.length;
    $('#today-date').textContent = persianDate(today, {weekday:'long', day:'numeric', month:'long'});
    $('#total-count').textContent = fa.format(total); $('#present-count').textContent = fa.format(counts.present);
    $('#absent-count').textContent = fa.format(counts.absent); $('#pending-count').textContent = fa.format(counts.pending);
    $('#present-rate').textContent = `${fa.format(total ? Math.round(counts.present / total * 100) : 0)}٪ از اعضا`;
    $('#daily-stats').innerHTML = weekDates().map((date, index) => {
      const stat = dayCounts(date); const pct = state.members.length ? Math.round(stat.present / state.members.length * 100) : 0;
      return `<div class="day-stat"><span class="day-name">${DAY_SHORT[index]}</span><strong>${fa.format(stat.present)}</strong><small>${fa.format(pct)}٪</small><div class="mini-bar"><i style="width:${pct}%"></i></div></div>`;
    }).join('');
  }
  function renderDaySelector() {
    $('#day-selector').innerHTML = weekDates().map((date, index) => `<button type="button" role="tab" aria-selected="${dateKey(date) === dateKey(selectedDate)}" class="day-tab ${dateKey(date) === dateKey(selectedDate) ? 'selected' : ''}" data-date="${dateKey(date)}"><span>${DAY_SHORT[index]}</span><small>${fa.format(date.getDate())}</small></button>`).join('');
  }
  function avatarText(name) { return [...name.trim()][0] || '؟'; }
  function memberCard(member, management = false) {
    const status = memberStatus(member.id, selectedDate);
    const sub = management ? 'عضو گروه' : status === 'present' ? 'وضعیت: حاضر' : status === 'absent' ? 'وضعیت: غایب' : 'وضعیت امروز ثبت نشده';
    return `<article class="member-row" data-member-row="${safeText(member.id)}"><div class="member-avatar">${safeText(avatarText(member.name))}</div><div class="member-main"><div class="member-name">${safeText(member.name)}</div><div class="member-sub">${sub}</div></div>${management ? `<div class="management-actions"><button class="small-action edit-member" type="button" aria-label="ویرایش ${safeText(member.name)}" title="ویرایش">✎</button><button class="small-action delete delete-member" type="button" aria-label="حذف ${safeText(member.name)}" title="حذف">⌫</button></div>` : `<div class="attendance-actions"><button class="status-button present ${status === 'present' ? 'active' : ''}" type="button" data-status="present" aria-pressed="${status === 'present'}">حاضر</button><button class="status-button absent ${status === 'absent' ? 'active' : ''}" type="button" data-status="absent" aria-pressed="${status === 'absent'}">غایب</button></div>`}</article>`;
  }
  function emptyBlock(title, text, withAdd = false) { return `<div class="empty-state"><strong>${title}</strong>${text}${withAdd ? '<br><button class="text-button empty-add" type="button">＋ افزودن عضو</button>' : ''}</div>`; }
  function renderAttendance() {
    renderDaySelector(); const query = $('#member-search').value.trim().toLocaleLowerCase('fa');
    const members = state.members.filter(member => member.name.toLocaleLowerCase('fa').includes(query));
    const pending = members.filter(member => !memberStatus(member.id, selectedDate));
    $('#member-total-label').textContent = `${fa.format(members.length)} عضو`;
    $('#attendance-list').innerHTML = members.length ? members.map(member => memberCard(member)).join('') : emptyBlock(state.members.length ? 'عضوی پیدا نشد' : 'هنوز عضوی ثبت نشده', state.members.length ? 'عبارت دیگری را جست‌وجو کنید.' : 'برای شروع، اعضای گروه را اضافه کنید.', !state.members.length);
    $('#unrecorded-badge').textContent = fa.format(pending.length);
    const section = $('#unrecorded-section');
    if (!pending.length || !state.members.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    section.innerHTML = `<div class="section-heading"><div><span class="eyebrow">نیاز به ثبت</span><h3>ثبت‌نشده‌ها</h3></div><span id="unrecorded-badge" class="count-badge">${fa.format(pending.length)}</span></div><div class="member-list">${pending.map(member => `<div class="pending-chip"><span>${safeText(member.name)}</span><small>ثبت‌نشده</small></div>`).join('')}</div>`;
  }
  function renderMembers() {
    const query = $('#members-search').value.trim().toLocaleLowerCase('fa');
    const members = state.members.filter(member => member.name.toLocaleLowerCase('fa').includes(query));
    $('#members-page-count').textContent = fa.format(state.members.length);
    $('#members-list').innerHTML = members.length ? members.map(member => memberCard(member, true)).join('') : emptyBlock(state.members.length ? 'عضوی پیدا نشد' : 'فهرست اعضا خالی است', 'از دکمه افزودن برای ثبت عضو استفاده کنید.', true);
  }
  function renderReports() {
    const dates = weekDates();
    $('#report-week-stats').innerHTML = dates.map(date => {
      const count = dayCounts(date); const total = state.members.length; const pct = total ? Math.round(count.present / total * 100) : 0;
      return `<div class="report-day-row"><span class="report-day-name">${dayName(date)}</span><div class="report-progress"><i style="width:${pct}%"></i></div><span class="report-day-count">${fa.format(count.present)} حاضر</span><span class="report-day-count">${fa.format(count.absent)} غایب</span><span class="report-day-percent">${fa.format(pct)}٪</span></div>`;
    }).join('');
    $('#report-member-rows').innerHTML = state.members.length ? state.members.map(member => {
      const counts = dates.reduce((acc, date) => { const status = memberStatus(member.id, date); if (status === 'present') acc.present++; else if (status === 'absent') acc.absent++; else acc.pending++; return acc; }, {present:0, absent:0, pending:0});
      const recorded = counts.present + counts.absent; const rate = recorded ? Math.round(counts.present / recorded * 100) : 0;
      return `<tr><td>${safeText(member.name)}</td><td>${fa.format(counts.present)}</td><td>${fa.format(counts.absent)}</td><td>${fa.format(counts.pending)}</td><td class="percent-cell">${fa.format(rate)}٪</td></tr>`;
    }).join('') : '<tr><td colspan="5" class="muted">برای تهیه گزارش، ابتدا اعضا را اضافه کنید.</td></tr>';
  }
  function renderAll() { updateWeekLabels(); renderDashboard(); renderAttendance(); renderMembers(); renderReports(); }
  function setPage(page) {
    activePage = page;
    $$('.page').forEach(element => element.classList.toggle('active', element.id === `${page}-page`));
    $$('.nav-item').forEach(element => element.classList.toggle('active', element.dataset.page === page));
    window.scrollTo({top:0, behavior:'smooth'});
    if (page === 'attendance') renderAttendance(); if (page === 'members') renderMembers(); if (page === 'reports') renderReports();
  }
  function changeWeek(amount) { selectedDate.setDate(selectedDate.getDate() + amount * 7); renderAll(); }
  function openMemberDialog(member = null) {
    $('#dialog-title').textContent = member ? 'ویرایش نام عضو' : 'افزودن عضو جدید';
    $('#dialog-eyebrow').textContent = member ? 'سوابق حضور حفظ می‌شود' : 'مدیریت اعضا';
    $('#member-name-input').value = member?.name || ''; $('#editing-member-id').value = member?.id || '';
    $('#member-dialog').showModal(); setTimeout(() => $('#member-name-input').focus(), 80);
  }
  function createId() { return globalThis.crypto?.randomUUID?.() || `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
  function onMemberSubmit(event) {
    event.preventDefault(); const name = $('#member-name-input').value.trim(); const id = $('#editing-member-id').value;
    if (!name) return;
    if (id) { const member = state.members.find(item => item.id === id); if (member) member.name = name; notify('نام عضو ویرایش شد؛ سوابق قبلی محفوظ است.'); }
    else { state.members.push({id:createId(), name}); notify('عضو جدید به فهرست اضافه شد.'); }
    saveState(); $('#member-dialog').close(); renderAll();
  }
  function deleteMember(id) {
    const member = state.members.find(item => item.id === id); if (!member) return;
    if (!window.confirm(`عضو «${member.name}» حذف شود؟ این کار سوابق حضور این عضو را نیز حذف می‌کند.`)) return;
    state.members = state.members.filter(item => item.id !== id);
    Object.values(state.attendance).forEach(day => { if (day && typeof day === 'object') delete day[id]; });
    saveState(); renderAll(); notify('عضو و سوابق حضورش حذف شدند.');
  }
  function setAttendance(id, status) {
    const key = dateKey(selectedDate); if (!state.attendance[key]) state.attendance[key] = {};
    state.attendance[key][id] = status; saveState(); renderAll();
  }
  function csvEscape(value) { return `"${String(value).replace(/"/g, '""')}"`; }
  function exportCsv() {
    if (!state.members.length) { notify('برای خروجی گرفتن، ابتدا اعضا را اضافه کنید.'); return; }
    const dates = weekDates(); const rows = [['نام عضو', ...dates.map(date => `${dayName(date)} ${persianDate(date, {day:'numeric', month:'numeric'})}`), 'حاضر', 'غایب', 'ثبت‌نشده', 'درصد حضور']];
    state.members.forEach(member => {
      const statuses = dates.map(date => { const status = memberStatus(member.id, date); return status === 'present' ? 'حاضر' : status === 'absent' ? 'غایب' : 'ثبت‌نشده'; });
      const present = statuses.filter(status => status === 'حاضر').length; const absent = statuses.filter(status => status === 'غایب').length; const pending = 7 - present - absent; const rate = present + absent ? Math.round(present / (present + absent) * 100) : 0;
      rows.push([member.name, ...statuses, present, absent, pending, `${rate}%`]);
    });
    const csv = '\ufeff' + rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
    downloadFile(csv, `gozaresh-hazoor-${dateKey(weekDates()[0])}.csv`, 'text/csv;charset=utf-8'); notify('گزارش CSV آماده شد.');
  }
  function downloadFile(content, filename, type) {
    const blob = new Blob([content], {type}); const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = filename; link.style.display = 'none'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportBackup() {
    const backup = {format:'rahbar-shahid-attendance', version:1, exportedAt:new Date().toISOString(), members:state.members, attendance:state.attendance};
    downloadFile(JSON.stringify(backup, null, 2), `backup-hozoor-${dateKey(new Date())}.json`, 'application/json;charset=utf-8'); notify('نسخه پشتیبان JSON ذخیره شد.');
  }
  async function importBackup(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.members) || !data.attendance || typeof data.attendance !== 'object' || Array.isArray(data.attendance)) throw new Error('ساختار فایل معتبر نیست.');
      const members = data.members.map(item => {
        if (!item || typeof item.name !== 'string' || typeof item.id !== 'string') throw new Error('اطلاعات یکی از اعضا معتبر نیست.');
        return {id:item.id, name:item.name.trim().slice(0,60)};
      }).filter(member => member.name);
      if (new Set(members.map(member => member.id)).size !== members.length) throw new Error('شناسه اعضا باید یکتا باشد.');
      if (!window.confirm(`اطلاعات فعلی با نسخه پشتیبان جایگزین شود؟ (${fa.format(members.length)} عضو)`)) return;
      state = {members, attendance:data.attendance}; saveState(); renderAll(); notify('بازیابی اطلاعات با موفقیت انجام شد.');
    } catch (error) { notify(`بازیابی ناموفق بود: ${error.message}`); }
    finally { $('#import-file').value = ''; }
  }
  function openBackupMenu() {
    const choice = window.prompt('برای پشتیبان‌گیری، عدد ۱ و برای بازیابی فایل JSON عدد ۲ را انتخاب کنید.', '۱');
    if (choice === '1' || choice === '۱') exportBackup();
    else if (choice === '2' || choice === '۲') $('#import-file').click();
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('button'); if (!target) return;
    if (target.dataset.page) { setPage(target.dataset.page); return; }
    if (target.dataset.go) { setPage(target.dataset.go); return; }
    if (target.dataset.date) { selectedDate = weekDates().find(date => dateKey(date) === target.dataset.date) || selectedDate; renderAll(); return; }
    if (target.dataset.status) { const row = target.closest('[data-member-row]'); if (row) setAttendance(row.dataset.memberRow, target.dataset.status); return; }
    if (target.classList.contains('empty-add')) { openMemberDialog(); return; }
    if (target.classList.contains('edit-member')) { const row = target.closest('[data-member-row]'); openMemberDialog(state.members.find(item => item.id === row?.dataset.memberRow)); return; }
    if (target.classList.contains('delete-member')) { const row = target.closest('[data-member-row]'); if (row) deleteMember(row.dataset.memberRow); return; }
    if (target.id === 'week-prev' || target.id === 'week-prev-att' || target.id === 'week-prev-report') { changeWeek(-1); return; }
    if (target.id === 'week-next' || target.id === 'week-next-att' || target.id === 'week-next-report') { changeWeek(1); return; }
    if (['add-member-top','add-member-bottom','add-member-page','add-member-empty'].includes(target.id)) { openMemberDialog(); return; }
    if (target.id === 'backup-button' || target.id === 'export-backup-button') { openBackupMenu(); return; }
    if (target.id === 'csv-button') { exportCsv(); return; }
    if (target.id === 'cancel-dialog') { $('#member-dialog').close(); }
  });
  $('#member-form').addEventListener('submit', onMemberSubmit);
  $('#member-search').addEventListener('input', renderAttendance);
  $('#members-search').addEventListener('input', renderMembers);
  $('#import-file').addEventListener('change', event => { const file = event.target.files?.[0]; if (file) importBackup(file); });
  $('#member-dialog').addEventListener('click', event => { if (event.target === $('#member-dialog')) $('#member-dialog').close(); });
  window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) { state = loadState(); renderAll(); } });

  const extraStyles = document.createElement('style'); extraStyles.textContent = '.pending-chip{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 9px;border-radius:10px;background:#382d191a;color:#d7cba8;font-size:10px}.pending-chip small{color:var(--amber);font-size:9px}.unrecorded-section .member-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}@media(max-width:350px){.unrecorded-section .member-list{grid-template-columns:1fr}}'; document.head.append(extraStyles);
  renderAll();
})();
