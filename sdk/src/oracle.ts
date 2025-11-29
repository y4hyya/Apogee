import { Contract } from '@stellar/stellar-sdk';

/**
 * Price Oracle Client
 * Interact with the price oracle smart contract
 */
export class OracleClient {
  private contract: Contract;
  private networkPassphrase: string;

  constructor(contractId: string, networkPassphrase: string = 'Test SDF Network ; September 2015') {
    this.contract = new Contract(contractId);
    this.networkPassphrase = networkPassphrase;
  }

  /**
   * Get price for an asset
   */
  async getPrice(asset: string): Promise<bigint> {
    // TODO: Query asset price
    throw new Error('Not implemented');
  }

  /**
   * Get price scaled by decimals
   */
  async getPriceScaled(asset: string): Promise<bigint> {
    // TODO: Query scaled price
    throw new Error('Not implemented');
  }
}

