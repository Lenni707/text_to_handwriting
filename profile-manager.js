/**
 * Profile Manager
 * Handles saving, loading, exporting, and importing handwriting profiles.
 * Each profile stores stroke data for every character, normalized to 0-1 range.
 */

const ProfileManager = (() => {
  const STORAGE_KEY = 'hwp_profiles';
  const ACTIVE_KEY = 'hwp_active_profile';

  function _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function _save(profiles) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch (err) {
      console.error('Failed to save profiles to localStorage:', err);
      if (window.showToast) {
        window.showToast('Storage quota exceeded. Unable to save profiles.', 'error');
      }
    }
  }

  function listProfiles() {
    const profiles = _load();
    return Object.values(profiles).sort((a, b) => a.createdAt - b.createdAt);
  }

  function getProfile(id) {
    const profiles = _load();
    return profiles[id] || null;
  }

  function saveProfile(profile) {
    const profiles = _load();
    if (!profile.id) {
      profile.id = 'profile_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }
    if (!profile.createdAt) {
      profile.createdAt = Date.now();
    }
    profile.updatedAt = Date.now();
    profiles[profile.id] = profile;
    _save(profiles);
    return profile.id;
  }

  function deleteProfile(id) {
    const profiles = _load();
    delete profiles[id];
    _save(profiles);
    const active = getActiveProfileId();
    if (active === id) {
      const remaining = Object.keys(profiles);
      setActiveProfileId(remaining.length > 0 ? remaining[0] : null);
    }
  }

  function getActiveProfileId() {
    return localStorage.getItem(ACTIVE_KEY) || null;
  }

  function setActiveProfileId(id) {
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  }

  function getActiveProfile() {
    const id = getActiveProfileId();
    if (!id) {
      const all = listProfiles();
      if (all.length > 0) {
        setActiveProfileId(all[0].id);
        return all[0];
      }
      return null;
    }
    return getProfile(id);
  }

  function exportProfileJSON(id) {
    const profile = getProfile(id);
    if (!profile) return null;
    return JSON.stringify(profile, null, 2);
  }

  function importProfileJSON(jsonString) {
    let profile;
    try {
      profile = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON format');
    }

    if (!profile || typeof profile !== 'object') {
      throw new Error('Invalid profile: must be an object');
    }
    if (!profile.name || typeof profile.name !== 'string') {
      throw new Error('Invalid profile: missing name');
    }
    if (!profile.characters || typeof profile.characters !== 'object' || Array.isArray(profile.characters)) {
      throw new Error('Invalid profile: characters must be an object');
    }

    // Perform deep validation of the character strokes schema
    for (const charKey of Object.keys(profile.characters)) {
      const strokes = profile.characters[charKey];
      if (!Array.isArray(strokes)) {
        throw new Error(`Invalid profile: characters.${charKey} must be an array of strokes`);
      }
      for (let sIdx = 0; sIdx < strokes.length; sIdx++) {
        const stroke = strokes[sIdx];
        if (!Array.isArray(stroke)) {
          throw new Error(`Invalid profile: stroke ${sIdx} of characters.${charKey} must be an array of points`);
        }
        for (let pIdx = 0; pIdx < stroke.length; pIdx++) {
          const pt = stroke[pIdx];
          if (!pt || typeof pt !== 'object' || Array.isArray(pt)) {
            throw new Error(`Invalid profile: point ${pIdx} in stroke ${sIdx} of characters.${charKey} must be an object`);
          }
          if (typeof pt.x !== 'number' || isNaN(pt.x) || typeof pt.y !== 'number' || isNaN(pt.y)) {
            throw new Error(`Invalid profile: point ${pIdx} in stroke ${sIdx} of characters.${charKey} must have numeric x and y`);
          }
          if (pt.pressure !== undefined && (typeof pt.pressure !== 'number' || isNaN(pt.pressure))) {
            throw new Error(`Invalid profile: point ${pIdx} in stroke ${sIdx} of characters.${charKey} must have numeric pressure`);
          }
        }
      }
    }

    // Assign a new ID to avoid collisions
    profile.id = 'profile_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    profile.createdAt = Date.now();
    profile.updatedAt = Date.now();
    profile.name = profile.name + ' (Imported)';

    const savedId = saveProfile(profile);
    return savedId;
  }

  function hasAnyProfile() {
    return listProfiles().length > 0;
  }

  return {
    listProfiles,
    getProfile,
    saveProfile,
    deleteProfile,
    getActiveProfileId,
    setActiveProfileId,
    getActiveProfile,
    exportProfileJSON,
    importProfileJSON,
    hasAnyProfile,
  };
})();
