import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, Users, Wifi, WifiOff, Circle, MessageCircle } from "lucide-react";
import { over } from "stompjs"
import SockJS from "sockjs-client/dist/sockjs"
import { MessageStatus } from "../entity";

// Mock STOMP client for demonstration
let stompClient:any = null;

const MessageArea = () => {
  const [privateMessage, setPrivateMessage] = useState(new Map());
  const [publicMessage, setPublicMessage] = useState([
    {
      id: 1,
      from: "System",
      content: "Welcome to the chat room! 🎉",
      sendTime: new Date().toISOString(),
      status: "MESSAGE"
    }
  ]);
  const [chatArea, setChatArea] = useState("PUBLIC");
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    reconnecting: false
  });
  const [userData, setUserData] = useState({
    username: "",
    receivername: "",
    message: "",
    connected: false,
  });
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState(new Set(["Alice", "Bob", "Charlie"]));

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Mock data for demonstration
  useEffect(() => {
    const mockPrivateChats = new Map([
      ["Alice", [
        {
          id: 1,
          from: "Alice",
          content: "Hey there! How are you doing?",
          sendTime: new Date(Date.now() - 300000).toISOString(),
          status: "MESSAGE"
        },
        {
          id: 2,
          from: userData.username || "You",
          content: "I'm doing great! Thanks for asking.",
          sendTime: new Date(Date.now() - 240000).toISOString(),
          status: "MESSAGE"
        }
      ]],
      ["Bob", [
        {
          id: 1,
          from: "Bob",
          content: "Did you see the latest update?",
          sendTime: new Date(Date.now() - 180000).toISOString(),
          status: "MESSAGE"
        }
      ]],
      ["Charlie", []]
    ]);
    setPrivateMessage(mockPrivateChats);
  }, [userData.username]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [publicMessage, privateMessage, scrollToBottom]);

  // Here useCallback Fucntion is used to Cached the state of connect fucntion across pages
  const connect = useCallback(() => {
    if (connectionStatus.connected) return;

    // to connect I need a steup a new SockJs URL for connecting of the first time.
    let sock = new SockJS("http://localhost:8080/chat");

    // Instantiate the steompclinet
    stompClient = over(sock);

    // Finally connect using stomp
    stompClient.connect({}, onConnected, onError);
    
    onConnected();
  }, []);

  const onConnected  = useCallback(() => {
    setConnectionStatus(prev => ({ ...prev, reconnecting: true }));
    
    // Simulate connection
      setConnectionStatus({ connected: true, reconnecting: false });
      setUserData(prev => ({ ...prev, connected: true }));

      // Here I need to subscribe the use to back puclic chatRoom conneciton and the provate connection
      stompClient.subscribe("chatroom/public",onPublicMessageReceived );
      stompClient.subscribe("/user/" + userData.username + "/private", onPrivateMessageReceived );
      
      // Add user to online list
      setOnlineUsers(prev => new Set(prev).add(userData.username));
      
      // Add join message
      // I think this message should come from the Backend, Right??
      // Yes kt soes that the use if actually connected toi the bacjkedn server

      // this message shoudl come from the onPublicMessageReceived [In the beckedn I need to Add somthing per user , If the message for that user is empty I should send this message]

      const joinMessage = {
        sender: userData.username,
        content: `${userData.username} joined the chat`,
        sendTime: new Date().toISOString(),
        status: MessageStatus.JOIN
      };

      
      setPublicMessage(prev => [...prev, joinMessage]); // Its stored in the Fronend, I also need to send this to the backend

      stompClient.send("/app/message",{},JSON.stringify(joinMessage));
  },[]);

  const onPublicMessageReceived = useCallback((payload: any) => {
    var payloadData = JSON.parse(payload.body);
    console.log(payload);
    switch(payloadData.status){
      // if the user is joining for the first time
      // with the status join createa private chat map (first time only)
      case MessageStatus.JOIN:
          if(!privateMessage.get(payloadData.sender)) {
              privateMessage.set(payloadData.sender,[]);
              setPrivateMessage(new Map(privateMessage));
          }
          setPublicMessage(prev => [...prev, payloadData]);
          break;
      case MessageStatus.MESSAGE:
          publicMessage.push(payloadData);
          setPublicMessage(prev => [...prev, payloadData]); // fot eh latest provate message
          break;
      default:
          setPublicMessage(prev => [...prev, payloadData]);
          console.log("Status is still fucking NULL");
          break;
      
  }
  },[privateMessage]); // TODO: Why??

  const onPrivateMessageReceived = (payload: any) => {
    var payloadData = JSON.parse(payload.body);
    console.log(payload);
    switch(payloadData.status){
      // if the user is joining for the first time
      // with the status join createa private chat map (first time only)
      case "READ":
          if(!privateMessage.get(payloadData.from)) {
              privateMessage.set(payloadData.from,[]);
              setPrivateMessage(new Map(privateMessage));
          }
          break;
      case "SENT":
          publicMessage.push(payloadData);
          setPublicMessage(prev => [...prev, payloadData]); // fot eh latest provate message
          break;
      case null:
          console.log("Status is still fucking NULL");
      
  }
 }

  const onError = () => {};

  const disconnect = useCallback(() => {
    setConnectionStatus({ connected: false });
    setUserData(prev => ({ ...prev, connected: false }));
    setOnlineUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(userData.username);
      return newSet;
    });
  }, [userData.username]);

  const registerUser = useCallback(() => {
    if (!userData.username.trim()) {
      alert("Please enter a username");
      return;
    }
    connect();
  }, [userData.username]);

  const sendPublicMessage = useCallback(() => {
    if (!stompClient || !userData.message.trim()) return;

    const newMessage = {
      sender: userData.username,
      content: userData.message,
      sendTime: new Date().toISOString(),
      status: MessageStatus.MESSAGE
    };

    stompClient.send("/app/message",{},JSON.stringify(newMessage)); // Sending to the backend

    setPublicMessage(prev => [...prev, newMessage]); // Saving in UI
    setUserData(prev => ({ ...prev, message: "" }));
    
  }, [userData.username,userData.message]);

  const sendPrivateMessage = useCallback(() => {
    if (!stompClient || !userData.message.trim()) return;

    const newMessage = {
      sender: userData.username,
      content: userData.message,
      sendTime: new Date().toISOString(),
      status: MessageStatus.MESSAGE
    };

    setPrivateMessage(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(chatArea)) {
        newMap.set(chatArea, []);
      }
      newMap.get(chatArea).push(newMessage);
      return newMap;
    });

    stompClient.send("/app/private-message",{},JSON.stringify(newMessage));
    setUserData(prev => ({ ...prev, message: "" }));
    
  }, [userData.username, userData.message, chatArea]);

  const handleMessageInput = useCallback((event) => {
    const { value } = event.target;
    console.log(value);
    userData.message = value;
    setUserData(prev => ({ ...prev, message: value }));
  }, []);

  const handleUsernameInput = useCallback((event) => {
    const { value } = event.target;
    console.log("USerName Input: " + value);
    userData.username = value;
    setUserData(prev => ({ ...prev, username: value }));
  }, []);


  const handleKeyPress = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (chatArea === "PUBLIC") {
        sendPublicMessage();
      } else {
        sendPrivateMessage();
      }
    }
  }, [chatArea, sendPublicMessage, sendPrivateMessage]);

  const formatTime = (timeString) => {
    if (!timeString) return "";
    return new Date(timeString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderTypingIndicator = () => {
    const typingArray = Array.from(typingUsers).filter(user => user !== userData.username);
    if (typingArray.length === 0) return null;

    return (
      <div className="typing-indicator">
        <MessageCircle size={16} />
        {typingArray.join(", ")} {typingArray.length === 1 ? "is" : "are"} typing...
      </div>
    );
  };

  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  const getCurrentMessages = () => {
    if (chatArea === "PUBLIC") {
      return publicMessage;
    }
    return privateMessage.get(chatArea) || [];
  };

  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      overflow: 'hidden'
    }}>
      {/* Connection Status */}
      {connectionStatus.reconnecting && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '12px 20px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #ff9800, #f57c00)',
          color: 'white',
          fontWeight: '600',
          fontSize: '14px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Wifi size={16} />
          Reconnecting...
        </div>
      )}

      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        {userData.connected ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            height: '90vh',
            maxHeight: '800px',
            borderRadius: '24px',
            boxShadow: '0 32px 64px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            overflow: 'hidden',
            minWidth: '1200px',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            {/* Member List */}
            <div style={{
              width: '320px',
              background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
              borderRight: '1px solid rgba(226, 232, 240, 0.8)',
              overflowY: 'auto',
              position: 'relative'
            }}>
              {/* Header */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '80px',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '700',
                fontSize: '18px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                zIndex: 3
              }}>
                <Users size={20} style={{ marginRight: '8px' }} />
                Chat Rooms
              </div>

              <ul style={{
                listStyle: 'none',
                padding: '100px 0 20px 0',
                margin: 0
              }}>
                <li
                  onClick={() => setChatArea("PUBLIC")}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 24px',
                    cursor: 'pointer',
                    margin: '4px 12px',
                    borderRadius: '16px',
                    fontWeight: '500',
                    background: chatArea === "PUBLIC" ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
                    color: chatArea === "PUBLIC" ? 'white' : '#2c3e50',
                    transform: chatArea === "PUBLIC" ? 'translateX(8px)' : 'none',
                    boxShadow: chatArea === "PUBLIC" ? '0 8px 16px rgba(102, 126, 234, 0.3)' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (chatArea !== "PUBLIC") {
                      e.target.style.background = 'rgba(102, 126, 234, 0.1)';
                      e.target.style.transform = 'translateX(8px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (chatArea !== "PUBLIC") {
                      e.target.style.background = 'transparent';
                      e.target.style.transform = 'none';
                    }
                  }}
                >
                  <MessageCircle size={16} style={{ marginRight: '12px' }} />
                  PUBLIC CHAT
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    background: chatArea === "PUBLIC" ? 'rgba(255, 255, 255, 0.2)' : 'rgba(102, 126, 234, 0.1)',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontWeight: '600'
                  }}>
                    ({onlineUsers.size} online)
                  </span>
                </li>

                {Array.from(privateMessage.keys()).map((name, index) => (
                  <li
                    key={index}
                    onClick={() => setChatArea(name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '16px 24px',
                      cursor: 'pointer',
                      margin: '4px 12px',
                      borderRadius: '16px',
                      fontWeight: '500',
                      background: chatArea === name ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
                      color: chatArea === name ? 'white' : '#2c3e50',
                      transform: chatArea === name ? 'translateX(8px)' : 'none',
                      boxShadow: chatArea === name ? '0 8px 16px rgba(102, 126, 234, 0.3)' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (chatArea !== name) {
                        e.target.style.background = 'rgba(102, 126, 234, 0.1)';
                        e.target.style.transform = 'translateX(8px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (chatArea !== name) {
                        e.target.style.background = 'transparent';
                        e.target.style.transform = 'none';
                      }
                    }}
                  >
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      marginRight: '12px',
                      border: '2px solid white',
                      background: onlineUsers.has(name) ? '#10b981' : '#6b7280',
                      boxShadow: onlineUsers.has(name) ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none'
                    }} />
                    {name}
                  </li>
                ))}
              </ul>
            </div>

            {/* Chat Content */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff'
            }}>
              {/* Chat Header */}
              <div style={{
                padding: '24px 32px',
                borderBottom: '1px solid #e2e8f0',
                background: 'linear-gradient(90deg, #f8fafc, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  {chatArea !== "PUBLIC" && (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: '700',
                      fontSize: '18px'
                    }}>
                      {getInitials(chatArea)}
                    </div>
                  )}
                  <div>
                    <h3 style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#2c3e50',
                      margin: 0
                    }}>
                      {chatArea === "PUBLIC" ? "Public Chat" : `Chat with ${chatArea}`}
                    </h3>
                    {chatArea !== "PUBLIC" && (
                      <p style={{
                        margin: 0,
                        color: '#64748b',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Circle size={8} fill={onlineUsers.has(chatArea) ? '#10b981' : '#6b7280'} color={onlineUsers.has(chatArea) ? '#10b981' : '#6b7280'} />
                        {onlineUsers.has(chatArea) ? 'Online' : 'Offline'}
                      </p>
                    )}
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: connectionStatus.connected ? '#10b981' : '#ef4444'
                }}>
                  {connectionStatus.connected ? <Wifi size={20} /> : <WifiOff size={20} />}
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>
                    {connectionStatus.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              {/* Chat Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px 32px',
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {getCurrentMessages().map((chat, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '12px',
                      maxWidth: '75%',
                      alignSelf: chat.from === userData.username ? 'flex-end' : 'flex-start',
                      flexDirection: chat.from === userData.username ? 'row-reverse' : 'row',
                      animation: 'messageSlideIn 0.3s ease-out'
                    }}
                  >
                    {chat.from !== userData.username && chat.from !== "System" && (
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #e2e8f0, #cbd5e0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '14px',
                        color: '#4a5568',
                        flexShrink: 0
                      }}>
                        {getInitials(chat.from)}
                      </div>
                    )}
                    
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{
                        background: chat.from === userData.username 
                          ? 'linear-gradient(135deg, #667eea, #764ba2)' 
                          : chat.from === "System" 
                            ? 'linear-gradient(135deg, #10b981, #059669)'
                            : '#f1f5f9',
                        padding: '16px 20px',
                        borderRadius: chat.from === userData.username 
                          ? '20px 20px 4px 20px' 
                          : '20px 20px 20px 4px',
                        fontSize: '16px',
                        lineHeight: '1.5',
                        color: (chat.from === userData.username || chat.from === "System") ? 'white' : '#2c3e50',
                        wordWrap: 'break-word',
                        boxShadow: chat.from === userData.username 
                          ? '0 4px 12px rgba(102, 126, 234, 0.3)' 
                          : '0 2px 8px rgba(0, 0, 0, 0.05)'
                      }}>
                        {chat.content}
                      </div>
                      
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                        padding: '0 8px',
                        alignSelf: chat.from === userData.username ? 'flex-start' : 'flex-end'
                      }}>
                        {formatTime(chat.sendTime)}
                      </div>
                    </div>

                    {chat.from === userData.username && (
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '14px',
                        color: 'white',
                        flexShrink: 0
                      }}>
                        {getInitials(chat.from)}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {renderTypingIndicator()}

              {/* Send Message */}
              <div style={{
                padding: '24px 32px',
                borderTop: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-end'
              }}>
                <textarea
                  ref={inputRef}
                  placeholder="Type a message..."
                  value={userData.message}
                  onChange={handleMessageInput}
                  onKeyPress={handleKeyPress}
                  disabled={!connectionStatus.connected}
                  style={{
                    flex: 1,
                    padding: '16px 24px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '24px',
                    fontSize: '16px',
                    resize: 'none',
                    outline: 'none',
                    background: '#f8fafc',
                    minHeight: '56px',
                    maxHeight: '120px',
                    lineHeight: '1.5',
                    fontFamily: 'inherit',
                    transition: 'all 0.3s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#667eea';
                    e.target.style.background = 'white';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.background = '#f8fafc';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                
                <button
                  type="button"
                  onClick={chatArea === "PUBLIC" ? sendPublicMessage : sendPrivateMessage}
                  disabled={!connectionStatus.connected || !userData.message.trim()}
                  style={{
                    padding: '16px 24px',
                    background: (!connectionStatus.connected || !userData.message.trim()) 
                      ? '#cbd5e0' 
                      : 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '24px',
                    cursor: (!connectionStatus.connected || !userData.message.trim()) ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: '120px',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (connectionStatus.connected && userData.message.trim()) {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 8px 16px rgba(102, 126, 234, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'none';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <Send size={16} />
                  Send
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            padding: '60px 50px',
            borderRadius: '24px',
            boxShadow: '0 32px 64px rgba(0, 0, 0, 0.12)',
            minWidth: '450px',
            textAlign: 'center',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <h2 style={{
              marginBottom: '40px',
              fontSize: '32px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Join Chat
            </h2>
            
            <input
              type="text"
              placeholder="Enter your username"
              value={userData.username}
              onChange={handleUsernameInput}
              onKeyPress={(e) => e.key === 'Enter' && registerUser()}
              disabled={connectionStatus.reconnecting}
              style={{
                width: '100%',
                padding: '18px 24px',
                fontSize: '16px',
                border: '2px solid #e8ecf4',
                borderRadius: '12px',
                marginBottom: '24px',
                background: '#f8fafc',
                fontWeight: '500',
                outline: 'none',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.background = 'white';
                e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e8ecf4';
                e.target.style.background = '#f8fafc';
                e.target.style.boxShadow = 'none';
                e.target.style.transform = 'none';
              }}
            />
            
            <button 
              type="button" 
              onClick={registerUser}
              disabled={connectionStatus.reconnecting || !userData.username.trim()}
              style={{
                width: '100%',
                padding: '18px',
                background: (connectionStatus.reconnecting || !userData.username.trim()) 
                  ? 'linear-gradient(135deg, #cbd5e0, #a0aec0)' 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: (connectionStatus.reconnecting || !userData.username.trim()) ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (!connectionStatus.reconnecting && userData.username.trim()) {
                  e.target.style.transform = 'translateY(-3px)';
                  e.target.style.boxShadow = '0 12px 24px rgba(102, 126, 234, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'none';
                e.target.style.boxShadow = 'none';
              }}
            >
              {connectionStatus.reconnecting ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Connecting...
                </>
              ) : (
                <>
                  <Wifi size={16} />
                  Connect
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes messageSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default MessageArea;

// What are the functions that is important here
// 1. Connect()  for first time for adding stomp connection
// 2. setPublicMessage() -< Here I need to add the message in the public message set, Not in the client side, But in the backend side
// 3. setPrivateMessage() -> Same for private chat
// 4. Handle input

// 5. What are the Important states need to added here?
// 6. * public message
//    * private message
//    * is user typing
//    * is user connected/online
//    * current message type by sender


//  Implementation-2

// import React, {useCallback, useEffect, useRef, useState } from "react"
// import { over } from "stompjs"
// import SockJS from "sockjs-client/dist/sockjs"
// import { type ConnectedStatus, MessageStatus, type TypingIndicator, type UserData, type Message } from "../entity";

// let stompClient: any = null

// const MessageArea: React.FC = () => {
//     const [privateMessage, setPrivateMessage] = useState<Map<string, Message[]>>(new Map());
//     const [publicMessage, setPublicMessage] = useState<Message[]>([]);
//     const [chatArea, setChatArea] = useState<string>("PUBLIC");
//     const [connectionStatus, setConnectionStatus] = useState<ConnectedStatus>({
//       connected: false,
//       reconnecting: false
//     })
//     const [userData, setUserData ] = useState<UserData>({
//         username: "",
//         receivername: "",
//         message: "",
//         connected: false,
//     });
//     const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
//     const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

//     const typingTimeoutRef = useRef<NodeJS.Timeout | null>(undefined);
//   const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(undefined);
//   const messagesEndRef = useRef<HTMLDivElement>(null);

//   // Auto-scroll to bottom of messages
//   const scrollToBottom = useCallback(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, []);

//   useEffect(() => {
//     scrollToBottom();
//   }, [publicMessage, privateMessage, scrollToBottom]);

//   // Enhanced connection with retry logic
//   const connect = useCallback(() => {

//     console.log("Inside Connect: " + userData.username);
//     if (connectionStatus.connected) return;

//     setConnectionStatus(prev => ({ ...prev, reconnecting: true }));
    
//     try {
//       const sock = new SockJS("http://localhost:8080/chat");
//       stompClient = over(sock);
      
//       // Configure heartbeat
//       stompClient.heartbeat.outgoing = 20000;
//       stompClient.heartbeat.incoming = 20000;

//       stompClient.connect({}, onConnected, onError);
//       console.log("Attempting to connect...");
//     } catch (error) {
//       console.error("Connection failed:", error);
//       onError(error);
//     }
//   }, [userData.username, connectionStatus.connected]);

//   // Enhanced connection success handler
//   const onConnected = useCallback(() => {
//     console.log("Successfully connected to WebSocket");
//     setConnectionStatus({ connected: true, reconnecting: false });
//     setUserData(prev => ({ ...prev, connected: true }));

//     console.log("📊 Username for subscriptions:", userData.username);
//     // Subscribe to channels
//     stompClient.subscribe("/chatroom/public", onPublicMessageReceived);
//     stompClient.subscribe("/user/" + userData.username + "/private", onPrivateMessageReceived);
//     stompClient.subscribe("/chatroom/typing", onTypingReceived);
//     stompClient.subscribe("/chatroom/status", onUserStatusReceived);

//     console.log("📢 Calling userJoin...");
//     // Announce user joining
//     userJoin();
//   }, [userData.username]);

//   // Enhanced error handler with reconnection
//   const onError = useCallback((error: any) => {
//     console.error("WebSocket error:", error);
//     setConnectionStatus({ 
//       connected: false, 
//       error: error.message || "Connection failed",
//       reconnecting: false 
//     });
    
//     // Auto-reconnect after 5 seconds
//     if (userData.username && !reconnectTimeoutRef.current) {
//       reconnectTimeoutRef.current = setTimeout(() => {
//         console.log("Attempting to reconnect...");
//         connect();
//         reconnectTimeoutRef.current = undefined;
//       }, 5000);
//     }
//   }, [connect, userData.username]);

//   // Enhanced public message handler
//   // Here I need to modify the payload for Message
//   const onPublicMessageReceived = useCallback((payload: any) => {
//     // So this payload is received form the Backedn right??
//     //  think payload is what it received from backend??
//     // Then what it is sending?
//     console.log(payload);
//     try {
//       const payloadData: Message = JSON.parse(payload.body);
//       console.log("Public message received:", payloadData);
//       setPublicMessage(prev => [...prev, payloadData]);
//     } catch (error) {
//       console.error("Error parsing public message:", error);
//     }
//   }, [privateMessage]);

//   // Enhanced private message handler
//   const onPrivateMessageReceived = useCallback((payload: any) => {
//     try {
//       const payloadData: Message = JSON.parse(payload.body);
//       console.log("Private message received:", payloadData);

//       setPrivateMessage(prev => {
//         const newMap = new Map(prev);
//         if (!newMap.has(payloadData.from)) {
//           newMap.set(payloadData.from, []);
//         }
//         newMap.get(payloadData.from)!.push(payloadData);
//         return newMap;
//       });
//     } catch (error) {
//       console.error("Error parsing private message:", error);
//     }
//   }, []);

//   // Typing indicator handler
//   const onTypingReceived = useCallback((payload: any) => {
//     try {
//       const typingData: TypingIndicator = JSON.parse(payload.body);
      
//       if (typingData.isTyping) {
//         setTypingUsers(prev => new Set(prev).add(typingData.username));
//       } else {
//         setTypingUsers(prev => {
//           const newSet = new Set(prev);
//           newSet.delete(typingData.username);
//           return newSet;
//         });
//       }

//       // Auto-remove typing indicator after 3 seconds
//       setTimeout(() => {
//         setTypingUsers(prev => {
//           const newSet = new Set(prev);
//           newSet.delete(typingData.username);
//           return newSet;
//         });
//       }, 3000);
//     } catch (error) {
//       console.error("Error parsing typing indicator:", error);
//     }
//   }, []);

//   // User status change handler
//   // Only when user is joining [Not necessry message format]
//   const onUserStatusReceived = useCallback((payload: any) => {
//     try {
//       const statusData = JSON.parse(payload.body);
      
//       switch (statusData.status) {
//         case MessageStatus.ONLINE:
//           setOnlineUsers(prev => new Set(prev).add(statusData.from));
//           break;
//         case MessageStatus.OFFLINE:
//           setOnlineUsers(prev => {
//             const newSet = new Set(prev);
//             newSet.delete(statusData.from);
//             return newSet;
//           });
//           break;
//       }
//     } catch (error) {
//       console.error("Error parsing user status:", error);
//     }
//   }, []);

//   const userJoin = useCallback(() => {
//     console.log("📤 userJoin called");
//     console.log("📊 STOMP client available:", !!stompClient);
//     console.log("📊 Username to send:", userData.username);

//     if (!stompClient) return;
    
//     const chatMessage: Message = {
//       from: userData.username,
//       content: `${userData.username} joined the chat`,
//       status: MessageStatus.JOIN,
//     };

//     console.log("📤 Sending message:", JSON.stringify(chatMessage, null, 2));
    
//     stompClient.send("/app/status", {}, JSON.stringify(chatMessage));
//   }, [userData.username]);

//   const disconnect = useCallback(() => {
//     if (stompClient) {
//       // Send leave message
//       const leaveMessage: Message = {
//         from: userData.username,
//         content: `${userData.username} left the chat`,
//         status: MessageStatus.LEAVE,
//       };
      
//       stompClient.send("/app/status", {}, JSON.stringify(leaveMessage));
//       stompClient.disconnect();
//     }
    
//     setConnectionStatus({ connected: false });
//     setUserData(prev => ({ ...prev, connected: false }));
    
//     // Clear timeouts
//     if (reconnectTimeoutRef.current) {
//       clearTimeout(reconnectTimeoutRef.current);
//       reconnectTimeoutRef.current = undefined;
//     }
//   }, [userData.username]);

//   const sendPublicMessage = useCallback(() => {
//     if (!stompClient || !userData.message.trim()) return;

//     // I think her eI also need to sedn the chatRoom also
//     const chatMessage: Message = {
//       from: userData.username,
//       content: userData.message,
//     };

//     stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
//     setUserData(prev => ({ ...prev, message: "" }));
//   }, [userData.username, userData.message]);

//   const sendPrivateMessage = useCallback(() => {
//     if (!stompClient || !userData.message.trim()) return;

//     const chatMessage: Message = {
//       from: userData.username,
//       receiver: chatArea,
//       content: userData.message,
//       status: MessageStatus.MESSAGE,
//     };

//     // Add to local state immediately
//     setPrivateMessage(prev => {
//       const newMap = new Map(prev);
//       if (!newMap.has(chatArea)) {
//         newMap.set(chatArea, []);
//       }
//       newMap.get(chatArea)!.push(chatMessage);
//       return newMap;
//     });

//     stompClient.send("/app/private-message", {}, JSON.stringify(chatMessage));
//     setUserData(prev => ({ ...prev, message: "" }));
//   }, [userData.username, userData.message, chatArea]);

//   // Typing indicator
//   const handleTyping = useCallback(() => {
//     if (!stompClient) return;

//     const typingMessage = {
//       from: userData.username,
//       receiverName: chatArea !== "PUBLIC" ? chatArea : undefined,
//       status: MessageStatus.TYPING,
//       content: "",
//     };

//     if (chatArea === "PUBLIC") {
//       stompClient.send("/app/typing", {}, JSON.stringify(typingMessage));
//     } else {
//       stompClient.send("/app/typing", {}, JSON.stringify(typingMessage));
//     }

//     // Clear existing timeout
//     if (typingTimeoutRef.current) {
//       clearTimeout(typingTimeoutRef.current);
//     }

//     // Stop typing after 2 seconds of inactivity
//     typingTimeoutRef.current = setTimeout(() => {
//       const stopTypingMessage = {
//         ...typingMessage,
//         status: MessageStatus.MESSAGE, // Stop typing
//       };
//       stompClient.send("/app/typing", {}, JSON.stringify(stopTypingMessage));
//     }, 2000);
//   }, [userData.username, chatArea]);

//   const handleMessageInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
//     const { value } = event.target;
//     setUserData(prev => ({ ...prev, message: value }));
    
//     // Trigger typing indicator
//     if (value.length > 0) {
//       handleTyping();
//     }
//   }, [handleTyping]);

//   const handleUsernameInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
//     const { value } = event.target;
//     console.log(event);
//     console.log(value);
//     setUserData(prev => ({ ...prev, username: value }));
//   }, []);

//   const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
//     if (event.key === 'Enter') {
//       if (chatArea === "PUBLIC") {
//         sendPublicMessage();
//       } else {
//         sendPrivateMessage();
//       }
//     }
//   }, [chatArea, sendPublicMessage, sendPrivateMessage]);

//   const registerUser = useCallback(() => {
//     if (!userData.username.trim()) {
//       console.error("❌ Empty username detected!");
//       alert("Please enter a username");
//       return;
//     }
//     console.log(userData);
//     console.log("✅ Proceeding with connection...");
//     connect();
//   }, [userData.username, connect]);

//   // Cleanup on unmount
//   useEffect(() => {
//     return () => {
//       if (typingTimeoutRef.current) {
//         clearTimeout(typingTimeoutRef.current);
//       }
//       if (reconnectTimeoutRef.current) {
//         clearTimeout(reconnectTimeoutRef.current);
//       }
//       disconnect();
//     };
//   }, [disconnect]);

//   const renderTypingIndicator = () => {
//     const typingArray = Array.from(typingUsers).filter(user => user !== userData.username);
//     if (typingArray.length === 0) return null;

//     return (
//       <div className="typing-indicator">
//         {typingArray.join(", ")} {typingArray.length === 1 ? "is" : "are"} typing...
//       </div>
//     );
//   };

//   return (
//     <div className="container">
//       {/* Connection Status */}
//       {connectionStatus.reconnecting && (
//         <div className="connection-status reconnecting">
//           Reconnecting...
//         </div>
//       )}
//       {connectionStatus.error && !connectionStatus.connected && (
//         <div className="connection-status error">
//           Connection failed: {connectionStatus.error}
//         </div>
//       )}

//       {userData.connected ? (
//         <div className="chat-box">
//           <div className="member-list">
//             <ul>
//               <li
//                 onClick={() => setChatArea("PUBLIC")}
//                 className={`member ${chatArea === "PUBLIC" ? "active" : ""}`}
//               >
//                 PUBLIC CHAT
//                 <span className="online-count">({onlineUsers.size} online)</span>
//               </li>
//               {Array.from(privateMessage.keys()).map((name, index) => (
//                 <li
//                   key={index}
//                   onClick={() => setChatArea(name)}
//                   className={`member ${chatArea === name ? "active" : ""}`}
//                 >
//                   <span className={`status-indicator ${onlineUsers.has(name) ? "online" : "offline"}`}></span>
//                   {name}
//                 </li>
//               ))}
//             </ul>
//           </div>

//           <div className="chat-content">
//             <div className="chat-header">
//               <h3>{chatArea === "PUBLIC" ? "Public Chat" : `Chat with ${chatArea}`}</h3>
//             </div>

//             <ul className="chat-messages">
//               {chatArea === "PUBLIC"
//                 ? publicMessage.map((chat, index) => (
//                     <li
//                       key={index}
//                       className={`message ${chat.from === userData.username ? "self" : ""}`}
//                     >
//                       {chat.from !== userData.username && (
//                         // <div className="avatar">{chat.from[0].toUpperCase()}</div>
//                         <div className="avatar">{chat.from}</div>
                        
//                       )}
//                       <div className="message-content">
//                       {chat.from !== userData.username && (
//                         <div className="message-sender">{chat.from}</div>
//                       )}
//                         <div className="message-data">{chat.content}</div>
//                         <div className="message-time">
//                           {chat.sendTime ? new Date(chat.sendTime).toLocaleTimeString() : ""}
//                         </div>
//                       </div>
//                       {chat.from === userData.username && (
//                         // <div className="avatar self">{chat.from[0].toUpperCase()}</div>
//                         <div className="avatar">{chat.from}</div>
//                       )}
//                     </li>
//                   ))
//                 : privateMessage.get(chatArea)?.map((chat, index) => (
//                     <li
//                       key={index}
//                       className={`message ${chat.from === userData.username ? "self" : ""}`}
//                     >
//                       {chat.from !== userData.username && (
//                         <div className="avatar">{chat.from[0].toUpperCase()}</div>
//                       )}
//                       <div className="message-content">
//                       {chat.from !== userData.username && (
//                         <div className="message-sender">{chat.from}</div>
//                       )}
//                         <div className="message-data">{chat.content}</div>
//                         <div className="message-time">
//                           {chat.sendTime ? new Date(chat.sendTime).toLocaleTimeString() : ""}
//                         </div>
//                       </div>
//                       {chat.from === userData.username && (
//                         <div className="avatar self">{chat.from[0].toUpperCase()}</div>
//                       )}
//                     </li>
//                   ))}
//               <div ref={messagesEndRef} />
//             </ul>

//             {renderTypingIndicator()}

//             <div className="send-message">
//               <input
//                 type="text"
//                 className="input-message"
//                 placeholder="Type a message..."
//                 value={userData.message}
//                 onChange={handleMessageInput}
//                 onKeyPress={handleKeyPress}
//                 disabled={!connectionStatus.connected}
//               />
//               <button
//                 type="button"
//                 className="send-button"
//                 onClick={chatArea === "PUBLIC" ? sendPublicMessage : sendPrivateMessage}
//                 disabled={!connectionStatus.connected || !userData.message.trim()}
//               >
//                 Send
//               </button>
//             </div>
//           </div>
//         </div>
//       ) : (
//         <div className="register">
//           <div className="register-form">
//             <h2>Join Chat</h2>
//             <input
//               type="text"
//               placeholder="Enter your username"
//               value={userData.username}
//               onChange={handleUsernameInput}
//               onKeyPress={(e) => e.key === 'Enter' && registerUser()}
//               disabled={connectionStatus.reconnecting}
//             />
//             <button 
//               type="button" 
//               onClick={registerUser}
//               disabled={connectionStatus.reconnecting || !userData.username.trim()}
//             >
//               {connectionStatus.reconnecting ? "Connecting..." : "Connect"}
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default MessageArea;














    //Implementation-1

//     const registerUser = () => {
//         connect(); // Create the connection using the stomp=clinet over Websocket
//     }
    
//     const connect = () => {
//         // to connect you need to setup new SockJS URL which clinet need to sedn HTTP in order to connect to stomp
//         let sock = new SockJS("http://localhost:8080/chat");
    
//         // Instantiate the sompClinet
//         stompClient = over(sock);
    
//         // Finally connect using stomp
//         stompClient.connect({}, onConnected, onError);
//         console.log("STOMP Get connected");

//         // Here I need to think of a way if the connection get lost, I can again get connected,But How to do it??

//     }
    
//     // handle on connection success
//     // subscribe to the different channels available on the backend (Login is implemented on the backed)
//     const onConnected = () => {
//         // update that the user is connected
//         console.log("Update the user Information");
//         setUserData({...userData, connected: true}); // I think this is used for appending the value of connected
    
//         // Now based on this used I ned to subscribed to public channel is user opt for ppublic channel (Simple Message Broker)
//         stompClient.subscribe("/chatroom/public", onPublicMessageReceived);
//         stompClient.subscribe("/user/" + userData.username + "/private", onPrivateMessageReceived); // So the user is subscribed to both public and private link
    
//         // This joins a new user to some private user with status JOIN
//         userJoin();
//     };
    
//     const onError = (error: any) => {
//         console.log(error);
//     };
    
//     // perform some buisness logic after receiving the message
//     const onPublicMessageReceived = (payload: any) => {
//         console.log(payload);
//         var payloadData=JSON.parse(payload.body);
//         console.log(payloadData.status);
//         switch(payloadData.status){
//             // if the user is joining for the first time
//             // with the status join createa private chat map (first time only)
//             case "JOIN":
//                 if(!privateMessage.get(payloadData.from)) {
//                     privateMessage.set(payloadData.from,[]);
//                     setPrivateMessage(new Map(privateMessage));
//                 }
//                 break;
//             case "MESSAGE":
//                 publicMessage.push(payloadData);
//                 setPublicMessage([...publicMessage]);
//                 break;
//             case null:
//                 console.log("Status is still fucking NULL");
            
//         } 
//     };
    
//     // on private message get the payload on subscription to a particular channel
//     const onPrivateMessageReceived = (payload: any) => {
//         var payloadData = JSON.parse(payload.body);
//         // if sender does not exist in the provate
//         // message map createa new map pf the user
//         // with empty array for private messages
//         if(!privateMessage.get(payloadData.from)){
//             privateMessage.set(payloadData.from, []);
//         }
//         // update the private message
//         privateMessage.get(payloadData.from).push(payloadData);
//         setPrivateMessage(new Map(privateMessage));
//     }
    
//     // This handle the first user message on join
//     // it sends the user details to general publlic (Maybe for joinign public chat)
//     const userJoin = () => {
//         var chatMessage = {
//             from: userData.username,
//             status: "JOIN",
//         }
//         stompClient.send("/app/message",{},JSON.stringify(chatMessage));
//     };
    
//     const sendPublicMessage = () => {
//         // if clinet is indeed connected
//         if(stompClient){
//             let chatMessage ={
//                 from: userData.username,
//                 content: userData.message,
//                 status: "MESSAGE"
//             };
//             // sednt eh user details to the message controller
//             stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
//             // update the user message to empty string (Why??)
//             setUserData({ ...userData, message: "" });
//         }
//     }
    
//     const sendPrivateMessage = () => {
//         // check user is connected
//         if(stompClient){
//             // set the user details including the mesage and the receiver
//             let chatMessage ={
//                 from: userData.username,
//                 receiverName: chatArea, // (How??)
//                 content: userData.message,
//                 status: "MESSAGE"
//             };
//             if(!privateMessage.get(chatArea)){
//                 privateMessage.set(chatArea, []);
//             }
    
//             // finally updat ethe receiver private message anyway
//             privateMessage.get(chatArea).push(chatMessage);
//             setPrivateMessage(new Map(privateMessage));
    
//             // update the user message to empty string
//             stompClient.send("/app/private-message", {}, JSON.stringify(chatMessage));
//             setUserData({...userData, message: ""});
    
//         }
//     }
    
//     const handleMessageInput = (event: any) => {
//         console.log(event);
//         const { value } = event.target; // I think it pick from the HTML frontend
//         console.log(value);
//         setUserData({...userData, message: value});
//     }
    
//     const handleUsernameInput = (event: any) => {
//         const { value } = event.target;
//         setUserData({...userData, username: value});
//     }

//   return (
//     <div className="container">
//       {userData.connected ? (
//         //if the user is connected display this
//         <div className="chat-box">
//           <div className="member-list">
//             {/* loop throught the member list */}
//             <ul>
//               {/* onclick set the tab to the current tab */}
//               <li
//                 onClick={() => {
//                   setChatArea("PUBLIC");
//                 }}
//                 className={`member ${chatArea === "PUBLIC" && "active"}`}
//               >
//                 PUBLIC CHAT
//               </li>
//               {/* spreads all the user into an array and then list them out */}
//               {[...privateMessage.keys()].map((name, index) => (
//                 <li
//                   onClick={() => {
//                     setChatArea(name);
//                   }}
//                   className={`member ${chatArea === name && "active"}`}
//                   key={index}
//                 >
//                   {name}
//                 </li>
//               ))}
//             </ul>
//           </div>
//           {chatArea === "PUBLIC" ? (
//             <div className="chat-content">
//               <ul className="chat-messages">
              
//               {
//                 publicMessage.map((chat, index)=>(
//                   <li
//                   className={`message ${
//                     chat.from === userData.username && "self"
//                   }`}
//                   key={index}
//                   >
//                       {chat.from !== userData.username && (
//                       <div className="avatar">{chat.from}</div>)}
//                       <div className="message-data">{chat.content}</div>
//                       {chat.from === userData.username && (
//                       <div className="avatar self">{chat.from}</div>
//                     )}
//                   </li>
//                 ))
//               }

//               </ul>

//               <div className="send-message">
//               <input
//                   type="text"
//                   className="input-message"
//                   placeholder="enter the message"
//                   value={userData.message}
//                   onChange={handleMessageInput}
//                 />
//                 <button
//                   type="button"
//                   className="send-button"
//                   onClick={sendPublicMessage}
//                 >
//                   send
//                 </button>
//               </div>
//             </div>
//           ) : (
//             <div className="chat-content">
//               <ul className="chat-messages">
//               {
//                 [...privateMessage.get(chatArea)].map((chat, index)=> (

//                   <li
//                   className={`message ${
//                     chat.from === userData.username && "self"
//                   }`}
//                   key={index}
//                   >
//                       {chat.from !== userData.username && (
//                       <div className="avatar">{chat.from}</div>)}
//                       <div className="message-data">{chat.content}</div>
//                       {chat.from === userData.username && (
//                       <div className="avatar self">{chat.from}</div>
//                     )}
//                   </li>
//                 ))
//               }

//               </ul>

//               <div className="send-message">
//               <input
//                   type="text"
//                   className="input-message"
//                   placeholder="enter the message"
//                   value={userData.message}
//                   onChange={handleMessageInput}
//                 />
//                 <button
//                   type="button"
//                   className="send-button"
//                   onClick={sendPrivateMessage}
//                 >
//                   send
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>
//       ) : (
//         //if the user is not connected display this
//         // this will handle the user login/registration
//         <div className="register">
//           <input
//             id="user-name"
//             placeholder="Enter your name"
//             name="userName"
//             value={userData.username}
//             onChange={handleUsernameInput}
//             margin="normal"
//           />
//           <button type="button" onClick={registerUser}>
//             connect
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default MessageArea

//  Tehe tutorial is saying that you need below functionality in Frontend side, LEt explore everything
// 1. connect():- I tihnk THis will open the SocketJs client and Websocket server connection
// 2. onconnect():- It passed the payload to others
// 3. onError():- handles the error while connecting with websocket
// 4. onPublicMessageReceived():- REceived payload deom subscriberd brocker handling public message
// 5. onPrivateMessageREceived():- Receiieved payload from subscribed brocker handling private message
// 6. onjoin():- Connect the user to chat platform
// 7. sendPrivateMessage()
// 8. sendPublicMessage()
// 9. handleUserNameInput()
// 10. handleMessageInput()
// 11. registerNewUser()