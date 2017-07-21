
/**
 * PubSub listener interface
 * 
 * @export
 * @interface PubSubSubscriberInterface
 */
export interface PubSubSubscriberInterface {
    /**
     * New subscribed channel message
     * 
     * @param channel 
     * @param message 
     */
    onMessage?(channel: string, message: string): void;
    
    /**
     * New pattern channel message
     * 
     * @param pattern 
     * @param channel 
     * @param message 
     */
    onPMessage?(pattern: string, channel: string, message: string): void;
    
    /**
     * Same as onMessage() but emits a buffer. If there is onMessage listener then emits string
     * 
     * @param channel 
     * @param message 
     */
    onMessageBuffer?(channel: string, message: string | Buffer): void;

    /**
     * Same as onPMessage() but emits a buffer. If there is onPMessage listener then emits string
     * 
     * @param pattern 
     * @param channel 
     * @param message 
     */
    onPMessageBuffer?(pattern: string, channel: string, message: string | Buffer): void;
    
    /**
     * On new subscription
     * 
     * @param channel 
     * @param count 
     */
    onSubscribe?(channel: string, count: number): void;

    /**
     * On new pattern subscription
     * 
     * @param pattern 
     * @param count 
     */
    onPSubscribe?(pattern: string, count: number): void;
    
    /**
     * On channel unsubscribe
     * 
     * @param channel 
     * @param count 
     */
    onUnsubscribe?(channel: string, count: number): void;
    
    /**
     * On pattern unsbuscribe
     * 
     * @param pattern 
     * @param count 
     */
    onPUnsubscribe?(pattern: string, count: number): void;
}