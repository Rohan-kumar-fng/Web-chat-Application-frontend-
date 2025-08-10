import React, {useCallback, useEffect, useRef, useState } from "react"
import { over } from "stompjs"
import SockJS from "sockjs-client/dist/sockjs"
import { type ConnectedStatus, MessageStatus, type TypingIndicator, type UserData, type Message } from "../entity";

let stompClient: any = null

const MessageArea: React.FC = () => {
    const [privateMessage, setPrivateMessage] = useState<Map<string, Message[]>>(new Map());
    const [publicMessage, setPublicMessage] = useState<Message[]>([]);
    const [chatArea, setChatArea] = useState<string>("PUBLIC");
    const [connectionStatus, setConnectionStatus] = useState<ConnectedStatus>({
      connected: false,
      reconnecting: false
    })
    const [userData, setUserData ] = useState<UserData>({
        username: "",
        receivername: "",
        message: "",
        connected: false,
    });
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(undefined);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [publicMessage, privateMessage, scrollToBottom]);

  // Enhanced connection with retry logic
  const connect = useCallback(() => {
    if (connectionStatus.connected) return;

    setConnectionStatus(prev => ({ ...prev, reconnecting: true }));
    
    try {
      const sock = new SockJS("http://localhost:8080/chat");
      stompClient = over(sock);
      
      // Configure heartbeat
      stompClient.heartbeat.outgoing = 20000;
      stompClient.heartbeat.incoming = 20000;

      stompClient.connect({}, onConnected, onError);
      console.log("Attempting to connect...");
    } catch (error) {
      console.error("Connection failed:", error);
      onError(error);
    }
  }, [connectionStatus.connected]);

  // Enhanced connection success handler
  const onConnected = useCallback(() => {
    console.log("Successfully connected to WebSocket");
    setConnectionStatus({ connected: true, reconnecting: false });
    setUserData(prev => ({ ...prev, connected: true }));

    console.log("📊 Username for subscriptions:", userData.username);
    // Subscribe to channels
    stompClient.subscribe("/chatroom/public", onPublicMessageReceived);
    stompClient.subscribe("/user/" + userData.username + "/private", onPrivateMessageReceived);
    stompClient.subscribe("/chatroom/typing", onTypingReceived);
    stompClient.subscribe("/chatroom/status", onUserStatusReceived);

    console.log("📢 Calling userJoin...");
    // Announce user joining
    userJoin();
  }, [userData.username]);

  // Enhanced error handler with reconnection
  const onError = useCallback((error: any) => {
    console.error("WebSocket error:", error);
    setConnectionStatus({ 
      connected: false, 
      error: error.message || "Connection failed",
      reconnecting: false 
    });
    
    // Auto-reconnect after 5 seconds
    if (userData.username && !reconnectTimeoutRef.current) {
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Attempting to reconnect...");
        connect();
        reconnectTimeoutRef.current = undefined;
      }, 5000);
    }
  }, [connect, userData.username]);

  // Enhanced public message handler
  const onPublicMessageReceived = useCallback((payload: any) => {
    try {
      const payloadData: Message = JSON.parse(payload.body);
      console.log("Public message received:", payloadData);

      switch (payloadData.status) {
        case MessageStatus.JOIN:
          setOnlineUsers(prev => new Set(prev).add(payloadData.from));
          if (!privateMessage.has(payloadData.from)) {
            setPrivateMessage(prev => new Map(prev).set(payloadData.from, []));
          }
          break;
        
        case MessageStatus.LEAVE:
          setOnlineUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(payloadData.from);
            return newSet;
          });
          break;
        
        case MessageStatus.MESSAGE:
          setPublicMessage(prev => [...prev, payloadData]);
          break;
      }
    } catch (error) {
      console.error("Error parsing public message:", error);
    }
  }, [privateMessage]);

  // Enhanced private message handler
  const onPrivateMessageReceived = useCallback((payload: any) => {
    try {
      const payloadData: Message = JSON.parse(payload.body);
      console.log("Private message received:", payloadData);

      setPrivateMessage(prev => {
        const newMap = new Map(prev);
        if (!newMap.has(payloadData.from)) {
          newMap.set(payloadData.from, []);
        }
        newMap.get(payloadData.from)!.push(payloadData);
        return newMap;
      });
    } catch (error) {
      console.error("Error parsing private message:", error);
    }
  }, []);

  // Typing indicator handler
  const onTypingReceived = useCallback((payload: any) => {
    try {
      const typingData: TypingIndicator = JSON.parse(payload.body);
      
      if (typingData.isTyping) {
        setTypingUsers(prev => new Set(prev).add(typingData.username));
      } else {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(typingData.username);
          return newSet;
        });
      }

      // Auto-remove typing indicator after 3 seconds
      setTimeout(() => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(typingData.username);
          return newSet;
        });
      }, 3000);
    } catch (error) {
      console.error("Error parsing typing indicator:", error);
    }
  }, []);

  // User status change handler
  const onUserStatusReceived = useCallback((payload: any) => {
    try {
      const statusData: Message = JSON.parse(payload.body);
      
      switch (statusData.status) {
        case MessageStatus.ONLINE:
          setOnlineUsers(prev => new Set(prev).add(statusData.from));
          break;
        case MessageStatus.OFFLINE:
          setOnlineUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(statusData.from);
            return newSet;
          });
          break;
      }
    } catch (error) {
      console.error("Error parsing user status:", error);
    }
  }, []);

  const userJoin = useCallback(() => {
    console.log("📤 userJoin called");
    console.log("📊 STOMP client available:", !!stompClient);
    console.log("📊 Username to send:", userData.username);

    if (!stompClient) return;
    
    const chatMessage: Message = {
      from: userData.username,
      content: `${userData.username} joined the chat`,
      status: MessageStatus.JOIN,
    };

    console.log("📤 Sending message:", JSON.stringify(chatMessage, null, 2));
    
    stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
  }, [userData.username]);

  const disconnect = useCallback(() => {
    if (stompClient) {
      // Send leave message
      const leaveMessage: Message = {
        from: userData.username,
        content: `${userData.username} left the chat`,
        status: MessageStatus.LEAVE,
      };
      
      stompClient.send("/app/message", {}, JSON.stringify(leaveMessage));
      stompClient.disconnect();
    }
    
    setConnectionStatus({ connected: false });
    setUserData(prev => ({ ...prev, connected: false }));
    
    // Clear timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
  }, [userData.username]);

  const sendPublicMessage = useCallback(() => {
    if (!stompClient || !userData.message.trim()) return;

    const chatMessage: Message = {
      from: userData.username,
      content: userData.message,
      status: MessageStatus.MESSAGE,
    };

    stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
    setUserData(prev => ({ ...prev, message: "" }));
  }, [userData.username, userData.message]);

  const sendPrivateMessage = useCallback(() => {
    if (!stompClient || !userData.message.trim()) return;

    const chatMessage: Message = {
      from: userData.username,
      receiver: chatArea,
      content: userData.message,
      status: MessageStatus.MESSAGE,
    };

    // Add to local state immediately
    setPrivateMessage(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(chatArea)) {
        newMap.set(chatArea, []);
      }
      newMap.get(chatArea)!.push(chatMessage);
      return newMap;
    });

    stompClient.send("/app/private-message", {}, JSON.stringify(chatMessage));
    setUserData(prev => ({ ...prev, message: "" }));
  }, [userData.username, userData.message, chatArea]);

  // Typing indicator
  const handleTyping = useCallback(() => {
    if (!stompClient) return;

    const typingMessage = {
      from: userData.username,
      receiverName: chatArea !== "PUBLIC" ? chatArea : undefined,
      status: MessageStatus.TYPING,
      content: "",
    };

    if (chatArea === "PUBLIC") {
      stompClient.send("/app/typing", {}, JSON.stringify(typingMessage));
    } else {
      stompClient.send("/app/typing", {}, JSON.stringify(typingMessage));
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      const stopTypingMessage = {
        ...typingMessage,
        status: MessageStatus.MESSAGE, // Stop typing
      };
      stompClient.send("/app/typing", {}, JSON.stringify(stopTypingMessage));
    }, 2000);
  }, [userData.username, chatArea]);

  const handleMessageInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setUserData(prev => ({ ...prev, message: value }));
    
    // Trigger typing indicator
    if (value.length > 0) {
      handleTyping();
    }
  }, [handleTyping]);

  const handleUsernameInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    console.log(event);
    console.log(value);
    setUserData(prev => ({ ...prev, username: value }));
  }, []);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (chatArea === "PUBLIC") {
        sendPublicMessage();
      } else {
        sendPrivateMessage();
      }
    }
  }, [chatArea, sendPublicMessage, sendPrivateMessage]);

  const registerUser = useCallback(() => {
    if (!userData.username.trim()) {
      console.error("❌ Empty username detected!");
      alert("Please enter a username");
      return;
    }
    console.log(userData);
    console.log("✅ Proceeding with connection...");
    connect();
  }, [userData.username, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  const renderTypingIndicator = () => {
    const typingArray = Array.from(typingUsers).filter(user => user !== userData.username);
    if (typingArray.length === 0) return null;

    return (
      <div className="typing-indicator">
        {typingArray.join(", ")} {typingArray.length === 1 ? "is" : "are"} typing...
      </div>
    );
  };

  return (
    <div className="container">
      {/* Connection Status */}
      {connectionStatus.reconnecting && (
        <div className="connection-status reconnecting">
          Reconnecting...
        </div>
      )}
      {connectionStatus.error && !connectionStatus.connected && (
        <div className="connection-status error">
          Connection failed: {connectionStatus.error}
        </div>
      )}

      {userData.connected ? (
        <div className="chat-box">
          <div className="member-list">
            <ul>
              <li
                onClick={() => setChatArea("PUBLIC")}
                className={`member ${chatArea === "PUBLIC" ? "active" : ""}`}
              >
                PUBLIC CHAT
                <span className="online-count">({onlineUsers.size} online)</span>
              </li>
              {Array.from(privateMessage.keys()).map((name, index) => (
                <li
                  key={index}
                  onClick={() => setChatArea(name)}
                  className={`member ${chatArea === name ? "active" : ""}`}
                >
                  <span className={`status-indicator ${onlineUsers.has(name) ? "online" : "offline"}`}></span>
                  {name}
                </li>
              ))}
            </ul>
          </div>

          <div className="chat-content">
            <div className="chat-header">
              <h3>{chatArea === "PUBLIC" ? "Public Chat" : `Chat with ${chatArea}`}</h3>
            </div>

            <ul className="chat-messages">
              {chatArea === "PUBLIC"
                ? publicMessage.map((chat, index) => (
                    <li
                      key={index}
                      className={`message ${chat.from === userData.username ? "self" : ""}`}
                    >
                      {chat.from !== userData.username && (
                        <div className="avatar">{chat.from[0].toUpperCase()}</div>
                      )}
                      <div className="message-content">
                        <div className="message-data">{chat.content}</div>
                        <div className="message-time">
                          {chat.sendTime ? new Date(chat.sendTime).toLocaleTimeString() : ""}
                        </div>
                      </div>
                      {chat.from === userData.username && (
                        <div className="avatar self">{chat.from[0].toUpperCase()}</div>
                      )}
                    </li>
                  ))
                : privateMessage.get(chatArea)?.map((chat, index) => (
                    <li
                      key={index}
                      className={`message ${chat.from === userData.username ? "self" : ""}`}
                    >
                      {chat.from !== userData.username && (
                        <div className="avatar">{chat.from[0].toUpperCase()}</div>
                      )}
                      <div className="message-content">
                        <div className="message-data">{chat.content}</div>
                        <div className="message-time">
                          {chat.sendTime ? new Date(chat.sendTime).toLocaleTimeString() : ""}
                        </div>
                      </div>
                      {chat.from === userData.username && (
                        <div className="avatar self">{chat.from[0].toUpperCase()}</div>
                      )}
                    </li>
                  ))}
              <div ref={messagesEndRef} />
            </ul>

            {renderTypingIndicator()}

            <div className="send-message">
              <input
                type="text"
                className="input-message"
                placeholder="Type a message..."
                value={userData.message}
                onChange={handleMessageInput}
                onKeyPress={handleKeyPress}
                disabled={!connectionStatus.connected}
              />
              <button
                type="button"
                className="send-button"
                onClick={chatArea === "PUBLIC" ? sendPublicMessage : sendPrivateMessage}
                disabled={!connectionStatus.connected || !userData.message.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="register">
          <div className="register-form">
            <h2>Join Chat</h2>
            <input
              type="text"
              placeholder="Enter your username"
              value={userData.username}
              onChange={handleUsernameInput}
              onKeyPress={(e) => e.key === 'Enter' && registerUser()}
              disabled={connectionStatus.reconnecting}
            />
            <button 
              type="button" 
              onClick={registerUser}
              disabled={connectionStatus.reconnecting || !userData.username.trim()}
            >
              {connectionStatus.reconnecting ? "Connecting..." : "Connect"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageArea;














    //Previous Implementation

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