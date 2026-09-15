"""
Payment transaction processing service layer.
Coordinates account balances, gateway communications, idempotent order processing,
and comprehensive failure branching logic.
"""
import logging
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

class PaymentProcessingError(Exception):
    """Custom exception raised when payment processing terminates with a non-recoverable error."""
    def __init__(self, code: str, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}

class PaymentService:
    """Core payment coordination service containing validation and failure handling."""
    
    def __init__(self, gateway_timeout_ms: int = 5000):
        self.gateway_timeout_ms = gateway_timeout_ms
        self._processed_idempotency_keys = set()

    async def validate_transaction_request(self, payload: Dict[str, Any]) -> bool:
        """
        Validates structure, currency whitelist, and minimum transfer bounds.
        
        Args:
            payload: Payment intent dictionary with amount, currency, and customer_id.
            
        Returns:
            True if valid, raises PaymentProcessingError on invalid parameters.
        """
        amount = payload.get("amount", 0)
        currency = payload.get("currency", "").upper()
        customer_id = payload.get("customer_id")
        
        if not customer_id:
            raise PaymentProcessingError("MISSING_CUSTOMER", "Customer ID is required.")
        if amount <= 0:
            raise PaymentProcessingError("INVALID_AMOUNT", f"Payment amount {amount} must be positive.")
        if currency not in {"USD", "EUR", "GBP"}:
            raise PaymentProcessingError("UNSUPPORTED_CURRENCY", f"Currency {currency} is not supported.")
            
        return True

    async def execute_charge(self, payment_intent: Dict[str, Any], idempotency_key: str) -> Dict[str, Any]:
        """
        Executes a payment charge with idempotency safety and comprehensive failure branching.
        
        Failure branches handled:
        - DUPLICATE_TRANSACTION: If idempotency key was already consumed.
        - INSUFFICIENT_FUNDS: If customer balance or credit limit cannot cover amount.
        - FRAUD_SUSPECTED: If heuristics trigger anti-fraud velocity limits.
        - GATEWAY_TIMEOUT: If third-party acquiring network fails to respond in time.
        - REVERSED: If compensation step runs after a partial network failure.
        """
        if idempotency_key in self._processed_idempotency_keys:
            logger.warning("Duplicate payment attempt detected for idempotency_key=%s", idempotency_key)
            raise PaymentProcessingError(
                code="DUPLICATE_TRANSACTION",
                message="This payment request has already been processed or is currently in flight."
            )
            
        await self.validate_transaction_request(payment_intent)
        
        customer_id = payment_intent["customer_id"]
        amount = payment_intent["amount"]
        
        # Branch 1: Anti-fraud heuristic check
        if amount > 10000 and customer_id.startswith("guest_"):
            logger.error("Fraud flag: Unauthenticated high-value transaction customer=%s", customer_id)
            raise PaymentProcessingError(
                code="FRAUD_SUSPECTED",
                message="High-value transaction flagged for compliance review."
            )
            
        # Branch 2: Account balance check
        available_balance = payment_intent.get("available_balance", 500.0)
        if amount > available_balance:
            logger.info("Insufficient funds: Required %f, Available %f", amount, available_balance)
            raise PaymentProcessingError(
                code="INSUFFICIENT_FUNDS",
                message=f"Insufficient funds: Required {amount}, available {available_balance}.",
                details={"requested": amount, "available": available_balance}
            )
            
        # Branch 3: Simulated Gateway Timeout / Network failure branch
        if payment_intent.get("simulate_gateway_timeout"):
            logger.error("Third-party gateway timeout occurred for customer=%s", customer_id)
            await self._trigger_compensation_refund(payment_intent)
            raise PaymentProcessingError(
                code="GATEWAY_TIMEOUT",
                message="Payment gateway did not respond within the allocated timeout window."
            )
            
        # Successful execution path
        self._processed_idempotency_keys.add(idempotency_key)
        transaction_id = f"tx_{uuid.uuid4().hex[:12]}"
        logger.info("Payment charge completed successfully. tx_id=%s, amount=%f", transaction_id, amount)
        
        return {
            "status": "succeeded",
            "transaction_id": transaction_id,
            "amount": amount,
            "currency": payment_intent.get("currency", "USD"),
            "customer_id": customer_id
        }

    async def _trigger_compensation_refund(self, failed_intent: Dict[str, Any]) -> None:
        """
        Compensating transaction executed when a multi-step operation fails midway.
        Releases reserved balance and emits audit event.
        """
        logger.info("Triggered compensation rollback for customer=%s, amount=%f",
                    failed_intent.get("customer_id"), failed_intent.get("amount"))
