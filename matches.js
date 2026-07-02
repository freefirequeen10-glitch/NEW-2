// matches.js
import { db } from "./firebase.js";
import { 
  collection, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Application Tournaments State
export let allTournamentsData = [];
export let currentArenaMode = 'Solo';
export let currentStatusFilter = 'all'; // Supports 'all', 'upcoming', 'live', 'completed', 'cancelled'

// Global real-time tournaments feed subscription
export function setupTournamentsListener() {
  onSnapshot(collection(db, "tournaments"), (snap) => {
    allTournamentsData = [];
    let liveCount = 0;
    
    snap.forEach(d => {
      const t = d.data();
      t.id = d.id;
      if (t.status === 'live') liveCount++;
      allTournamentsData.push(t);
    });

    // Update main dashboard metrics
    const totalTournamentsEl = document.getElementById('stat-total-tournaments');
    const liveMatchesEl = document.getElementById('stat-live-matches');
    
    if (totalTournamentsEl) totalTournamentsEl.innerText = snap.size;
    if (liveMatchesEl) liveMatchesEl.innerText = liveCount;

    // Refresh display
    window.renderCategorizedTournaments();
  });
}

// Mode navigation triggers
window.switchArenaMode = function(mode, tabEl) {
  currentArenaMode = mode;
  
  // Clean active states across all tabs
  document.querySelectorAll('.arena-tab').forEach(t => {
    t.classList.remove('tab-active');
  });

  if (tabEl) {
    tabEl.classList.add('tab-active');
  }

  const searchInput = document.getElementById('arena-search-input');
  if (searchInput) searchInput.value = '';
  
  window.renderCategorizedTournaments();
};

// Global status navigation triggers for the user side
window.switchStatusFilter = function(status, tabEl) {
  currentStatusFilter = status;
  
  // Update status filter active tab visual feedback if elements exist
  document.querySelectorAll('.status-tab').forEach(t => {
    t.classList.remove('status-tab-active');
  });
  
  if (tabEl) {
    tabEl.classList.add('status-tab-active');
  }
  
  window.renderCategorizedTournaments();
};

// Handle create tournament button trigger animations
window.triggerCreateArena = function(btn) {
  const ripple = document.createElement('span');
  ripple.className = 'ripple-effect';
  
  const rect = btn.getBoundingClientRect();
  ripple.style.left = (event.clientX - rect.left) + 'px';
  ripple.style.top  = (event.clientY - rect.top) + 'px';
  
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
  
  if (typeof window.toggleTournamentForm === 'function') {
    window.toggleTournamentForm(true);
  }
};

// Core renderer for the premium category card panels
window.renderCategorizedTournaments = function() {
  // Update counts on tab controllers dynamically
  const modes = ['Solo', 'Duo', 'Squad'];
  modes.forEach(mode => {
    const lowerMode = mode.toLowerCase();
    const modeCount = allTournamentsData.filter(t => (t.mode || 'Solo') === mode).length;
    const countEl = document.getElementById(`count-${lowerMode}`);
    if (countEl) {
      countEl.innerText = modeCount + ' Arena' + (modeCount !== 1 ? 's' : '');
    }
  });

  const searchInput = document.getElementById('arena-search-input');
  const searchQ = (searchInput?.value || '').toLowerCase().trim();
  const container = document.getElementById('arena-cards-grid');
  
  if (!container) return;

  // Determine context to serve matches safely (Admin vs User filters)
  const isAdminView = document.getElementById('adm-view-tournaments') !== null || window.location.pathname.includes('admin.html');
  
  let filtered = [];

  if (isAdminView) {
    // Admin panel displays all statuses including Hidden, Cancelled, and Completed for the active mode
    filtered = allTournamentsData.filter(t => (t.mode || 'Solo') === currentArenaMode);
  } else {
    // User-side filtering sequence matching state mapping expectations
    filtered = allTournamentsData.filter(t => {
      // 1. Must match active category tab (Solo, Duo, Squad)
      if ((t.mode || 'Solo') !== currentArenaMode) return false;
      
      // 2. Hidden matches must never be displayed to users
      if (t.status === 'hidden') return false;

      // Translate legacy 'active' mapping to 'upcoming' cleanly
      const normalizedStatus = t.status === 'active' ? 'upcoming' : t.status;

      // 3. Evaluate match status filters
      if (currentStatusFilter === 'all') {
        // ALL shows ONLY Upcoming and Live matches
        return normalizedStatus === 'upcoming' || normalizedStatus === 'live';
      } else if (currentStatusFilter === 'upcoming') {
        return normalizedStatus === 'upcoming';
      } else if (currentStatusFilter === 'live') {
        return normalizedStatus === 'live';
      } else if (currentStatusFilter === 'completed') {
        return normalizedStatus === 'completed';
      } else if (currentStatusFilter === 'cancelled') {
        return normalizedStatus === 'cancelled';
      }
      return false;
    });
  }

  // Handle Search Queries
  if (searchQ) {
    filtered = filtered.filter(t =>
      (t.title && t.title.toLowerCase().includes(searchQ)) ||
      (t.game  && t.game.toLowerCase().includes(searchQ))
    );
  }

  // Handle empty state gracefully
  container.style.opacity = '0';
  container.style.transform = 'translateY(6px)';
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="arena-empty-state col-span-full">
        <div class="text-4xl mb-4 opacity-40">${currentArenaMode === 'Solo' ? '👤' : currentArenaMode === 'Duo' ? '👥' : '👨‍👩‍👦'}</div>
        <p class="text-sm font-bold text-gray-500 uppercase tracking-widest">No Matches Found</p>
        <p class="text-xs text-gray-600 mt-1">${searchQ ? 'Try a different search term.' : 'Matches are currently unavailable.'}</p>
      </div>`;
    
    requestAnimationFrame(() => {
      container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
    });
    return;
  }

  const modeTagClass = currentArenaMode === 'Solo' ? 'solo' : currentArenaMode === 'Duo' ? 'duo' : 'squad';
  const modeIcon = currentArenaMode === 'Solo' ? '👤' : currentArenaMode === 'Duo' ? '👥' : '👨‍👩‍👦';

  // Build card DOM structures
  filtered.forEach((t, i) => {
    const statusClass = t.status === 'live' ? 'status-live' :
                       (t.status === 'upcoming' || t.status === 'active') ? 'status-active' :
                       t.status === 'completed' ? 'status-completed' :
                       t.status === 'cancelled' ? 'status-cancelled' : 'status-hidden';

    const statusLabel = t.status === 'live' ? '<i class="fa-solid fa-circle fa-beat" style="font-size:6px"></i> Live' :
                       (t.status === 'upcoming' || t.status === 'active') ? '<i class="fa-solid fa-clock" style="font-size:9px"></i> Upcoming' :
                       t.status === 'completed' ? '<i class="fa-solid fa-check" style="font-size:9px"></i> Completed' :
                       t.status === 'cancelled' ? '<i class="fa-solid fa-ban" style="font-size:9px"></i> Cancelled' :
                       '<i class="fa-solid fa-eye-slash" style="font-size:9px"></i> Hidden';

    const slotsUsed = t.joinedCount || 0;
    const slotsTotal = t.totalSlots || 100;
    const slotsPct = Math.min(100, Math.round((slotsUsed / slotsTotal) * 100));
    const slotsBarColor = slotsPct >= 90 ? '#ef4444' : slotsPct >= 60 ? '#f59e0b' : '#10b981';

    const card = document.createElement('div');
    card.className = `tournament-card-premium ${statusClass}`;
    card.style.animationDelay = (i * 0.04) + 's';
    
    card.innerHTML = `
      <div class="flex gap-0 min-h-0">
        <div class="w-28 md:w-36 flex-shrink-0 relative self-stretch">
          ${t.banner
            ? `<img src="${t.banner}" class="w-full h-full object-cover" style="min-height:110px;max-height:160px;" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full bg-black/60 flex items-center justify-center text-gray-600 text-xs font-bold uppercase tracking-wider\\'>No Image</div>'">`
            : `<div class="w-full bg-gradient-to-br from-admin-neon/10 to-transparent flex items-center justify-center" style="min-height:110px;"><i class="fa-solid fa-gamepad text-3xl text-gray-700"></i></div>`
          }
          <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/70 to-transparent pointer-events-none"></div>
        </div>
        <div style="width:1px;background:rgba(255,255,255,0.06);flex-shrink:0;"></div>
        <div class="flex-1 min-w-0 p-4 flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="card-mode-tag ${modeTagClass}">${modeIcon} ${currentArenaMode}</span>
              <span class="text-[9px] text-gray-500 font-bold uppercase tracking-widest truncate">${t.game || 'Game'}</span>
            </div>
            <h4 class="font-rajdhani font-bold text-white text-lg leading-tight truncate" title="${t.title}">${t.title}</h4>
            ${t.map ? `<p class="text-[9px] text-gray-500 mt-0.5 font-medium"><i class="fa-solid fa-map-location-dot mr-1"></i>${t.map}</p>` : ''}
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="card-stat-pill">
              <span class="stat-label">Entry Fee</span>
              <span class="stat-value text-gray-200">₹${t.entryFee || 0}</span>
            </div>
            <div class="card-stat-pill">
              <span class="stat-label">Prize Pool</span>
              <span class="stat-value gold-text">₹${t.prizePool || 0}</span>
            </div>
            <div class="card-stat-pill">
              <span class="stat-label">Per Kill</span>
              <span class="stat-value text-emerald-400">₹${t.perKill || 0}</span>
            </div>
            <div class="card-stat-pill">
              <span class="stat-label">Slots</span>
              <span class="stat-value text-gray-200">${slotsUsed}<span class="text-gray-600 text-xs font-normal">/${slotsTotal}</span></span>
            </div>
          </div>
          <div>
            <div style="height:3px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${slotsPct}%;background:${slotsBarColor};border-radius:2px;transition:width 0.6s ease;"></div>
            </div>
            <div class="flex justify-between mt-1">
              <span class="text-[9px] text-gray-600 font-medium">${slotsPct}% full</span>
              <span class="text-[9px] text-gray-600 font-medium">${slotsTotal - slotsUsed} left</span>
            </div>
          </div>
        </div>
        <div style="width:1px;background:rgba(255,255,255,0.06);flex-shrink:0;"></div>
        <div class="w-28 md:w-32 flex-shrink-0 p-3 flex flex-col items-center justify-center gap-3 text-center">
          <span class="card-status-badge ${statusClass}">${statusLabel}</span>
          <div>
            <div class="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Time</div>
            <div class="text-[11px] font-bold text-admin-neon leading-tight">${t.time || '--:--'}</div>
            <div class="text-[9px] text-gray-500 mt-0.5">${t.date || 'TBD'}</div>
          </div>
        </div>
      </div>
      <hr class="card-divider">
      <div class="px-4 py-2.5">
        <div class="room-info-strip">
          <i class="fa-solid fa-door-open text-gray-600 text-xs flex-shrink-0"></i>
          <div class="room-info-item flex-1 min-w-0">
            <span class="ri-label">Room ID:</span>
            <span class="ri-value truncate">${t.roomId || 'Not Set'}</span>
          </div>
          <div style="width:1px;height:16px;background:rgba(255,255,255,0.08);flex-shrink:0;"></div>
          <div class="room-info-item flex-1 min-w-0">
            <span class="ri-label">Pass:</span>
            <span class="ri-value truncate">${t.roomPass || 'Not Set'}</span>
          </div>
        </div>
      </div>
      
      ${isAdminView ? `
        <hr class="card-divider">
        <div class="px-4 py-3 flex gap-2">
          <button onclick="window.editTournament('${t.id}')" class="card-action-btn btn-edit-card">
            <i class="fa-solid fa-pen-to-square" style="font-size:10px"></i> Edit
          </button>
          <button onclick="window.publishTournament('${t.id}')" class="card-action-btn btn-publish-card">
            <i class="fa-solid fa-paper-plane" style="font-size:10px"></i> Publish
          </button>
          <button onclick="window.deleteTournament('${t.id}')" class="card-action-btn btn-delete-card">
            <i class="fa-solid fa-trash" style="font-size:10px"></i> Delete
          </button>
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  });

  requestAnimationFrame(() => {
    container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
  });
};