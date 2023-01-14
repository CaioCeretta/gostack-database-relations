import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const foundCustomer = await this.customersRepository.findById(customer_id);

    if(!foundCustomer) {
      throw new AppError('Could not found a customer with the given id');
    }

    const foundProducts = await this.productsRepository.findAllById(products);

    if(foundProducts.length === 0) {
      throw new AppError('No products were found with the given ids');
    }

    const foundProductsIds = foundProducts.map(product => product.id);

    const inexistentProducts = products.filter(
      product => !foundProductsIds.includes(product.id)
    );

    if(inexistentProducts.length > 0) {
      throw new AppError(`Couldn\'t find any products with ${inexistentProducts[0].id} ids`)
    }

    const productsWithNoStock = products.filter(
      product => foundProducts.filter(p => p.id === product.id)[0].quantity <  product.quantity,
    );

    console.log(productsWithNoStock.length)

    if(productsWithNoStock.length > 0) {
      throw new AppError(
        `The quantity ${productsWithNoStock[0].quantity} for the product ${productsWithNoStock[0].id} isn\'t avaiable for purchase`
      )
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: foundProducts.filter(prod => prod.id === product.id)[0].price
    }))

    const order = await this.ordersRepository.create({
      customer: foundCustomer,
      products: serializedProducts
    })

    const { order_products } = order;

    const productOrderedQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        foundProducts.filter(p => p.id === product.product_id)[0].quantity - product.quantity
    }))

    await this.productsRepository.updateQuantity(productOrderedQuantity);

    return order;

  }
}

export default CreateOrderService;
