import { Controller } from "@hotwired/stimulus"
import consumer from "../channels/consumer"

export default class extends Controller {
  static targets = ["messageInput"]
  
  connect() {
    this.subscription = consumer.subscriptions.create("ChatChannel", {
      connected: () => {
        console.log("Connected to ChatChannel")
      },
      
      disconnected: () => {
        console.log("Disconnected from ChatChannel")
      },
      
      received: (data) => {
        this.displayMessage(data)
      }
    })
  }
  
  disconnect() {
    if (this.subscription) {
      this.subscription.unsubscribe()
    }
  }
  
  toggle() {
    const panel = document.getElementById('chatPanel')
    const toggleBtn = document.getElementById('chatToggle')
    
    panel.classList.toggle('show')
    toggleBtn.classList.toggle('hidden')
  }
  
  close() {
    const panel = document.getElementById('chatPanel')
    const toggleBtn = document.getElementById('chatToggle')
    
    panel.classList.remove('show')
    toggleBtn.classList.remove('hidden')
  }
  
  sendMessage(event) {
    event.preventDefault()
    
    const message = this.messageInputTarget.value.trim()
    if (message === '') return
    
    // Display user message immediately
    this.addMessageToChat(message, 'user')
    
    // Send message through ActionCable
    this.subscription.send({ message: message })
    
    // Clear input
    this.messageInputTarget.value = ''
  }
  
  displayMessage(data) {
    // Display the assistant's response
    this.addMessageToChat(data.response, 'assistant')
  }
  
  addMessageToChat(message, sender) {
    const messagesContainer = document.getElementById('chatMessages')
    
    // Remove the welcome message if it exists
    const welcomeMessage = messagesContainer.querySelector('.text-center')
    if (welcomeMessage) {
      welcomeMessage.remove()
    }
    
    const messageElement = document.createElement('div')
    messageElement.className = `chat-message ${sender}`
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
    messageElement.innerHTML = `
      <div class="message-content">
        <div class="message-bubble">
          ${this.escapeHtml(message)}
        </div>
        <div class="message-time">${time}</div>
      </div>
    `
    
    messagesContainer.appendChild(messageElement)
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }
  
  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}