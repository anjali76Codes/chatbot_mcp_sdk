export interface Product {
  uid: string;
  title: string;
  price: number;
  description: string;
  category: string;
  material: string;
  gemstone: string;
  image: {
    url: string;
  };
}