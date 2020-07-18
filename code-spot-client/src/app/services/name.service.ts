import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NameService {
  private myName: string;
  private peerNames = new Map<string, string>();
  private names = [
    'Bird',
    'Dog',
    'Donkey',
    'Drever',
    'Earwig',
    'Seal',
    'Penguin',
    'Flamingo',
    'Fossa',
    'Cat',
    'Bear',
    'Lion',
    'Tiger',
    'Snake',
    'Python',
    'Turtle',
    'Frog',
    'Deer',
    'Bat',
    'Horse',
    'Wolf',
    'Squirrel',
    'Giraffe',
    'Leopard',
    'Panda',
    'Gorilla',
    'Raccoon',
    'Owl',
    'Otter',
    'Goat',
    'Shark',
    'Crocodile',
    'Chimpanzee',
    'Koala',
    'Cheetah',
    'Chicken',
    'Duck',
    'Sheep',
    'Sea Lion',
    'Hare',
    'Weasel',
    'Goose',
    'Ostrich',
    'Kangaroo',
    'Armadillo',
    'Falcon',
    'Lizard',
    'Vulture',
    'Bull',
    'Akita',
    'Albatross',
    'Hornet',
    'Avocet',
    'Baboon',
    'Badger',
    'Balinese',
    'Buffalo',
    'Chinchilla',
    'Cichlid',
    'Parrot',
    'Butterfly',
    'Hedgehog',
    'Ant',
    'Spider',
    'Antelope',
    'Lemurs',
    'Hyenas',
    'Mice',
    'Rat',
    'Elephant',
    'Fox',
    'Snail',
    'Fish',
    'Salmon',
    'Fly',
    'Cow',
    'Rabit',
    'Possum',
    'Camel',
    'Chipmunk',
    'Zebra',
    'Mamba',
    'Rhino',
    'Octopus',
    'Monkey',
    'Owl',
    'Aligator',
    'Starfish',
    'Crab',
    'Jellyfish',
    'Ox',
    'Eagle',
    'Woodpecker',
    'Walrus'
  ];

  giveMyselfRandomName(): void {
    const randIndex = Math.floor(Math.random() * this.names.length);
    this.myName = this.names[randIndex];
  }

  getMyName(): string {
    return this.myName;
  }

  setMyName(name: string): void {
    this.myName = name;
  }

  setPeerName(peerId: string, name: string): void {
    this.peerNames.set(peerId, name);
  }

  getPeerName(peerId: string): string {
    return this.peerNames.get(peerId);
  }
}
