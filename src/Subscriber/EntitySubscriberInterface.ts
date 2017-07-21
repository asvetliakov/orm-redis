
export interface EntitySubscriberInterface<T> {
    listenTo(): Function;

    beforeSave?(entity: T): Promise<void>;
    
    afterSave?(entity: T): Promise<void>;
    
    beforeLoad?(objectPayload: object): Promise<void>;
    
    afterLoad?(entity: T): Promise<void>;
    
    beforeRemove?(entity: T): Promise<void>;
    
    afterRemove?(): Promise<void>;
}