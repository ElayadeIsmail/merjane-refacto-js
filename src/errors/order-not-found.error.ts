export class OrderNotFoundError extends Error {
	public readonly code = 'ORDER_NOT_FOUND' as const;

	public constructor(orderId: number) {
		super(`Order not found: ${orderId}`);
		this.name = 'OrderNotFoundError';
	}
}
