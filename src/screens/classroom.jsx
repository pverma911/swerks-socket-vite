import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  UserCheck,
  Play,
  Square,
  LogOut,
  School,
  User,
  Wifi,
  WifiOff,
  Clock,
  Calendar,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { io } from "socket.io-client";

export const VirtualClassroom = () => {
  // Socket connection
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // User state
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState("Student");

  // Classroom state
  const [classroom, setClassroom] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [isInClassroom, setIsInClassroom] = useState(false);
  const [isClassActive, setIsClassActive] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const [showActiveSessions, setShowActiveSessions] = useState(false);

  // Form states
  const [joinForm, setJoinForm] = useState({
    roomId: "",
    name: "",
    email: "",
    role: "Student",
  });

  const [createForm, setCreateForm] = useState({
    name: "",
  });

  // UI states
  const [activeTab, setActiveTab] = useState("join");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [serverUrl, setServerUrl] = useState("http://localhost:8080");
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // Helper function to reset classroom state and redirect to join page
  const resetToJoinPage = () => {
    setIsInClassroom(false);
    setClassroom(null);
    setCurrentSession(null);
    setIsClassActive(false);
    setUser(null);
    setUserRole("Student");
    setShowActiveSessions(false);
    setActiveSessions([]);
    // Reset join form but keep the room ID if available
    setJoinForm((prev) => ({
      ...prev,
      name: "",
      email: "",
      role: "Student",
    }));
    setActiveTab("join");
  };

  // Initialize socket connection
  useEffect(() => {
    const connectSocket = async () => {
      try {
        // Check if socket.io is available
        const newSocket = io(serverUrl, {
          transports: ["websocket", "polling"],
          timeout: 5000,
          forceNew: true,
        });

        // Connection event handlers
        newSocket.on("connect", () => {
          console.log("Connected to server:", newSocket.id);
          setIsConnected(true);
          setConnectionError(null);
          addMessage("Connected to server");
        });

        newSocket.on("disconnect", (reason) => {
          console.log("Disconnected from server:", reason);
          setIsConnected(false);
          addMessage(`Disconnected: ${reason}`);
        });

        newSocket.on("connect_error", (error) => {
          console.error("Connection error:", error);
          setIsConnected(false);
          setConnectionError(error.message);
          addMessage(`Connection error: ${error.message}`);
        });

        newSocket.on("reconnect", (attemptNumber) => {
          console.log("Reconnected after", attemptNumber, "attempts");
          setIsConnected(true);
          setConnectionError(null);
          addMessage(`Reconnected (attempt ${attemptNumber})`);
        });

        newSocket.on("reconnect_error", (error) => {
          console.error("Reconnection error:", error);
          setConnectionError(error.message);
          addMessage(`Reconnection failed: ${error.message}`);
        });

        // Classroom event handlers
        newSocket.on("join-success", (data) => {
          console.log("Join success:", data);
          setClassroom(data.classroom);
          setIsInClassroom(true);
          setShowActiveSessions(false);
          setIsClassActive(!!data.classroom.startedAt && !data.classroom?.endedAt);
          addMessage(data.message);
          setError(null);
        });

        newSocket.on("set-user", (data) => {
          console.log("Setting user:", data);
          if (data) {
            setUser({
              _id: data._id,
              name: data.name,
              email: data.email,
              role: data.role,
            });

            setUserRole(data.role);
          }
        });

        newSocket.on("classroom-updated", (data) => {
          console.log("Classroom updated:", data);
          setClassroom(data);
          addMessage("Classroom updated");
        });

        newSocket.on("class-session-updated", (data) => {
          console.log("Class session updated:", data);
          setCurrentSession(data);
          setIsClassActive(!!data.startedAt && !data.endedAt);
          addMessage("Class session updated");
        });

        newSocket.on("class-room-created", (data) => {
          console.log("Class started:", data);
          setIsClassActive(true);
          addMessage(`${data.message} by ${data.startedBy}`);
        });

        newSocket.on("class-session-ended", (data) => {
          console.log("Class ended:", data);
          setIsClassActive(false);
          addMessage(`${data.message} by ${data.endedBy}`);

          // Add a delay before redirecting to allow users to see the message
          setTimeout(() => {
            addMessage("Session ended. Redirecting to join page...");
            setTimeout(() => {
              resetToJoinPage();
            }, 2000); // 2 second delay to show the redirect message
          }, 1000); // 1 second delay to show the session ended message
        });

        newSocket.on("leave-success", (data) => {
          console.log("Leave success:", data);
          setIsInClassroom(false);
          setClassroom(null);
          setCurrentSession(null);
          setIsClassActive(false);
          addMessage(data.message);
        });

        newSocket.on("user-joined", (data) => {
          console.log("User joined:", data);
          addMessage(
            `${data.participant.name} joined as ${data.participant.role}`
          );
          // Update classroom participants
          if (classroom) {
            const updatedClassroom = { ...classroom };
            if (data.participant.role === "Teacher") {
              updatedClassroom.teacherParticipant = [
                ...(updatedClassroom.teacherParticipant || []),
                data.participant,
              ];
            } else {
              updatedClassroom.studentParticipant = [
                ...(updatedClassroom.studentParticipant || []),
                data.participant,
              ];
            }
            setClassroom(updatedClassroom);
          }
        });

        newSocket.on("user-left", (data) => {
          console.log("User left:", data);
          addMessage(`${data.participant.name} left the classroom`);
          // Update classroom participants
          if (classroom) {
            const updatedClassroom = { ...classroom };
            if (data.participant.role === "Teacher") {
              updatedClassroom.teacherParticipant =
                updatedClassroom.teacherParticipant?.filter(
                  (p) => p.email !== data.participant.email
                ) || [];
            } else {
              updatedClassroom.studentParticipant =
                updatedClassroom.studentParticipant?.filter(
                  (p) => p.email !== data.participant.email
                ) || [];
            }
            setClassroom(updatedClassroom);
          }
        });

        newSocket.on("active-sessions-list", (data) => {
          console.log("Active sessions received:", data);
          setActiveSessions(data || []);
          setIsLoadingSessions(false);
          addMessage(`Found ${data.sessions?.length || 0} active sessions`);
        });

        newSocket.on("error", (data) => {
          console.error("Socket error:", data);
          setError(data.message);
          addMessage(`Error: ${data.message}`);
          setIsLoadingSessions(false);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);
      } catch (error) {
        console.error("Failed to initialize socket:", error);
        setConnectionError(error.message);
        addMessage(`Failed to connect: ${error.message}`);
      }
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [serverUrl]);

  // Auto-scroll messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const addMessage = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setMessages((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleCreateClassroom = async () => {
    if (!createForm.name.trim()) {
      setError("Please enter a classroom name");
      return;
    }

    try {
      const response = await fetch(`${serverUrl}/classroom/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: createForm.name }),
      });

      const data = await response.json();

      if (data.success) {
        addMessage(`Classroom created with ID: ${data.data.roomId}`);
        setJoinForm((prev) => ({ ...prev, roomId: data.data.roomId }));
        setActiveTab("join");
        setCreateForm({ name: "" });
        setError(null);
      } else {
        setError(data.message);
        addMessage(`Failed to create classroom: ${data.message}`);
      }
    } catch (error) {
      console.error("Create classroom error:", error);
      setError("Failed to create classroom. Check if server is running.");
      addMessage(`Create classroom error: ${error.message}`);
    }
  };

  const handleViewActiveSessions = (roomId) => {
    if (!socket || !isConnected) {
      setError("Not connected to server");
      return;
    }

    if (!joinForm.name.trim() || !joinForm.email.trim()) {
      setError("Please enter your name and email first");
      return;
    }

    setIsLoadingSessions(true);
    setShowActiveSessions(true);
    const data = {
      participant: {
        email: joinForm.email.trim(),
        role: joinForm.role,
        name: joinForm.name,
      },
    };

    socket.emit("get-user", data);
    console.log("Triggering view session with roomId");
    if (roomId) {
      console.log("View session with roomId exist", { roomId });

      socket.emit("get-active-sessions-room", { roomId });
    } else {
      socket.emit("get-active-sessions");
    }
    addMessage("Fetching active sessions...");
  };

  const handleJoinSpecificSession = (session) => {
    if (!socket || !isConnected) {
      setError("Not connected to server");
      return;
    }

    setUserRole(joinForm.role);

    const joinData = {
      sessionId: session._id,
      participant: user,
    };

    console.log("Joining specific session:", joinData);
    socket.emit("join-session", joinData);
    addMessage(`Joining session: ${session.classroomName}`);
  };

  const handleJoinClassroom = () => {
    if (!socket || !isConnected) {
      setError("Not connected to server");
      return;
    }

    if (
      !joinForm.roomId.trim() ||
      !joinForm.name.trim() ||
      !joinForm.email.trim()
    ) {
      setError("Please fill in all fields");
      return;
    }

    const data = {
      participant: {
        email: joinForm.email.trim(),
        role: joinForm.role,
        name: joinForm.name,
      },
    };

    socket.emit("get-user", data);

    const joinData = {
      roomId: joinForm.roomId.trim(),
      participant: user,
    };

    console.log("Joining classroom:", joinData);
    // socket.emit("start-classroom", joinData);
    socket.emit("start-class-room", joinData);

    addMessage(`Attempting to join room: ${joinForm.roomId}`);
  };

  const handleStartNewSession = () => {
    if (!socket || !isConnected) {
      setError("Not connected to server");
      return;
    }

    if (!joinForm.name.trim() || !joinForm.email.trim()) {
      setError("Please enter your name and email first");
      return;
    }

    // For starting a new session, we need a classroom first
    // This could trigger classroom creation flow
    setActiveTab("create");
    addMessage("To start a new session, create a classroom first");
  };

  const handleRefreshSessions = () => {
    if (!socket || !isConnected) {
      setError("Not connected to server");
      return;
    }

    setIsLoadingSessions(true);
    socket.emit("get-active-sessions");
    addMessage("Refreshing active sessions...");
  };

  const handleBackToJoinForm = () => {
    setShowActiveSessions(false);
    setActiveSessions([]);
    setError(null);
  };

  const handleStartClass = () => {
    if (!socket || !isConnected) {
      setError("Not connected to server");
      return;
    }

    console.log("Starting class");
    socket.emit("start-class");
    addMessage("Requesting to start class...");
  };

  const handleEndClass = () => {
    if (!socket || !isConnected) {
      setError("Not connected to server");
      return;
    }

    console.log("Ending class");
    socket.emit("end-class");
    addMessage("Requesting to end class...");
  };

  const handleLeaveClassroom = () => {
    if (!socket || !isConnected) {
      setError("Not connected to server");
      return;
    }

    console.log("Leaving classroom");
    socket.emit("leave-classroom");
    addMessage("Leaving classroom...");
  };

  const handleReconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    // Trigger reconnection by changing server URL state
    setServerUrl((prev) => prev);
    setConnectionError(null);
    addMessage("Attempting to reconnect...");
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const renderConnectionStatus = () => (
    <div className="flex items-center justify-center gap-2 mb-4">
      {isConnected ? (
        <>
          <Wifi className="text-green-500" size={20} />
          <span className="text-sm text-green-600 font-medium">
            Connected to {serverUrl}
          </span>
        </>
      ) : (
        <>
          <WifiOff className="text-red-500" size={20} />
          <span className="text-sm text-red-600 font-medium">
            {connectionError
              ? `Connection failed: ${connectionError}`
              : "Disconnected"}
          </span>
          <button
            onClick={handleReconnect}
            className="ml-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            Reconnect
          </button>
        </>
      )}
    </div>
  );

  const renderServerConfig = () => (
    <div className="bg-gray-50 p-4 rounded-lg mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Server URL
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="http://localhost:8080"
          disabled={isConnected}
        />
        {!isConnected && (
          <button
            onClick={handleReconnect}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );

  const renderActiveSessionsList = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={handleBackToJoinForm}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft size={18} />
          Back to Join Form
        </button>
        <button
          onClick={handleRefreshSessions}
          disabled={isLoadingSessions}
          className="flex items-center gap-2 px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={isLoadingSessions ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">Active Sessions</h3>
        <p className="text-sm text-blue-600 mb-4">
          Join an existing session or start a new one
        </p>

        {isLoadingSessions ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Loading sessions...</p>
          </div>
        ) : (
          <>
            {activeSessions.length > 0 ? (
              <div className="space-y-3 mb-4">
                {activeSessions
                  .filter((session) => session.classRoomId)
                  .map((session, index) => (
                    <div
                      key={session.classRoomId._id || index}
                      className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">
                            {session.classRoomId.name ||
                              `Session ${session.roomId}`}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Room ID: {session.classRoomId._id}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar size={12} />
                              Started:{" "}
                              {session?.startedAt
                                ? formatTime(session?.startedAt)
                                : "N/A"}
                            </div>
                            {/* <div className="flex items-center gap-1">
                              <Users size={12} />
                              {session.participantCount || 0} participants
                            </div> */}
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              Active
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleJoinSpecificSession(session)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
                <Clock className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-gray-600 mb-2">No active sessions found</p>
                <p className="text-sm text-gray-500">
                  Start a new session or check back later
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-blue-200">
              <button
                onClick={handleJoinClassroom}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Play size={18} />
                Start New Session
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderJoinForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your Name
        </label>
        <input
          type="text"
          value={joinForm.name}
          onChange={(e) =>
            setJoinForm((prev) => ({ ...prev, name: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={joinForm.email}
          onChange={(e) =>
            setJoinForm((prev) => ({ ...prev, email: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Role
        </label>
        <select
          value={joinForm.role}
          onChange={(e) =>
            setJoinForm((prev) => ({ ...prev, role: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Student">Student</option>
          <option value="Teacher">Teacher</option>
        </select>
      </div>

      <div className="space-y-3">
        <button
          onClick={() =>handleViewActiveSessions()}
          disabled={!isConnected}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <UserCheck size={20} />
          View Active Sessions
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">
              Or join with Room ID
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Room ID
          </label>
          <input
            type="text"
            value={joinForm.roomId}
            onChange={(e) =>
              setJoinForm((prev) => ({ ...prev, roomId: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter room ID"
          />
        </div>

        <button
          // onClick={handleJoinClassroom}
          onClick={() => handleViewActiveSessions(joinForm?.roomId)}
          disabled={!isConnected}
          className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <UserCheck size={20} />
          Join with Room ID
        </button>
      </div>
    </div>
  );

  const renderCreateForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Classroom Name
        </label>
        <input
          type="text"
          value={createForm.name}
          onChange={(e) =>
            setCreateForm((prev) => ({ ...prev, name: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter classroom name"
        />
      </div>

      <button
        onClick={handleCreateClassroom}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
      >
        <School size={20} />
        Create Classroom
      </button>
    </div>
  );

  const renderParticipantsList = () => {
    if (!classroom) return null;

    const teachers = classroom.teacherParticipant || [];
    const students = classroom.studentParticipant || [];

    return (
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <User size={18} />
            Teachers ({teachers.length})
          </h3>
          <div className="space-y-2">
            {teachers.length > 0 ? (
              teachers.map((teacher, index) => (
                <div
                  key={teacher._id || index}
                  className="flex items-center gap-2 bg-white p-2 rounded"
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="font-medium">{teacher.name}</span>
                  <span className="text-sm text-gray-500">
                    ({teacher.email})
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No teachers in classroom</p>
            )}
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
            <Users size={18} />
            Students ({students.length})
          </h3>
          <div className="space-y-2">
            {students.length > 0 ? (
              students.map((student, index) => (
                <div
                  key={student._id || index}
                  className="flex items-center gap-2 bg-white p-2 rounded"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium">{student.name}</span>
                  <span className="text-sm text-gray-500">
                    ({student.email})
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No students in classroom</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderClassroomControls = () => {
    if (userRole !== "Teacher") {
      return (
        <div className="bg-yellow-50 p-4 rounded-lg">
          <p className="text-yellow-800">
            {isClassActive
              ? "🟢 Class is currently active"
              : "🔴 Class is not active. Waiting for teacher to start..."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex gap-3">
          {!isClassActive ? (
            <button
              onClick={handleStartClass}
              disabled={!isConnected}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Play size={18} />
              Start Class
            </button>
          ) : (
            <button
              onClick={handleEndClass}
              disabled={!isConnected}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Square size={18} />
              End Class
            </button>
          )}
        </div>

        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-blue-800 text-sm">
            {isClassActive
              ? "🟢 Class is active - Students can join"
              : "🔴 Class is not active - Students cannot join"}
          </p>
        </div>
      </div>
    );
  };

  const renderClassroomView = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {classroom?.name}
            </h2>
            <p className="text-sm text-gray-500">
              Session ID: {classroom?._id}
            </p>
            <p className="text-sm text-gray-600">
              You joined as: <span className="font-semibold">{userRole}</span>
            </p>
          </div>
          <button
            onClick={handleLeaveClassroom}
            disabled={!isConnected}
            className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <LogOut size={18} />
            Leave
          </button>
        </div>

        {renderClassroomControls()}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Participants</h3>
        {renderParticipantsList()}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Activity Log</h3>
        <div className="bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto">
          {messages.map((message, index) => (
            <div key={index} className="text-sm text-gray-700 mb-1">
              {message}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Virtual Classroom
          </h1>
          {renderConnectionStatus()}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {!isInClassroom ? (
          <div className="bg-white p-6 rounded-lg shadow-md">
            {renderServerConfig()}

            {showActiveSessions ? (
              renderActiveSessionsList()
            ) : (
              <>
                <div className="flex mb-6">
                  <button
                    onClick={() => setActiveTab("join")}
                    className={`flex-1 py-2 px-4 text-center border-b-2 ${
                      activeTab === "join"
                        ? "border-blue-500 text-blue-600"
                        : "border-gray-200 text-gray-600"
                    }`}
                  >
                    Join Classroom
                  </button>
                  <button
                    onClick={() => setActiveTab("create")}
                    className={`flex-1 py-2 px-4 text-center border-b-2 ${
                      activeTab === "create"
                        ? "border-blue-500 text-blue-600"
                        : "border-gray-200 text-gray-600"
                    }`}
                  >
                    Create Classroom
                  </button>
                </div>

                {activeTab === "join" ? renderJoinForm() : renderCreateForm()}
              </>
            )}
          </div>
        ) : (
          renderClassroomView()
        )}

        {/* Instructions for Socket.IO setup */}
        {!isConnected && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">
              Setup Instructions
            </h3>
            <div className="text-blue-700 text-sm space-y-2">
              <p>To use this Virtual Classroom with Socket.IO:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Include the Socket.IO client library in your HTML:</li>
                <code className="block bg-blue-100 p-2 rounded text-xs mt-1">
                  {
                    '<script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.4/socket.io.js"></script>'
                  }
                </code>
                <li>
                  Make sure your backend server is running on the specified URL
                </li>
                <li>Ensure CORS is properly configured on your server</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VirtualClassroom;
