export const WORLD_SIZE = {
    RADIUS: 5000,
    CENTER_X: 5000,
    CENTER_Y: 5000,
};

export const GAME_SETTINGS = {
    SNAKE_START_SPEED: 150,
    SNAKE_BOOST_MULTIPLIER: 2.0,
    SNAKE_TURN_SPEED: 3.25,
    SNAKE_START_WIDTH: 25,
    MAX_BOTS: 15,
    DURATIONS: {
        '2x': 20,
        '5x': 15,
        '10x': 10,
    } as { [key: string]: number },
};
