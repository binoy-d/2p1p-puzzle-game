import java.awt.Color;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.RenderingHints;
import java.awt.event.KeyEvent;
import java.util.ArrayList;
import javax.swing.JFrame;
import javax.swing.JPanel;
import java.awt.event.KeyListener;
import java.util.Scanner;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.io.File;
import java.awt.MouseInfo;
import java.io.FileNotFoundException;
import java.awt.Image;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.IOException;

public class Enemy extends Point {

	Game parentGame;
	String[][] currentMap;

	public Enemy(int x, int y, Game g) {
		super(x, y);
		currentMap = g.getCurrentMap();
		parentGame = g;

	}

	public void tick() {
		for (Player p : parentGame.getPlayers()) {
			if (p.x == x && p.y == y) {
				parentGame.initialize();
			}
		}
		boolean moved = false;
		int currentVal = Integer.parseInt(currentMap[y][x]);
		for (int r = y - 1; r <= y + 1 && moved == false; r++) {
			for (int c = x - 1; c <= x + 1; c++) {
				int newVal = 0;
				if (isInteger(currentMap[r][c]))
					newVal = Integer.parseInt(currentMap[r][c]);
				if (newVal - 1 == currentVal) {
					currentMap[y][x] = "" + (18 - currentVal);
					x = c;
					y = r;
					moved = true;
				}
				if (currentVal == 17) {
					currentVal = 1;
				}
			}
		}
	}

	public static boolean isInteger(String s) {
		try {
			Integer.parseInt(s);
		} catch (NumberFormatException e) {
			return false;
		} catch (NullPointerException e) {
			return false;
		}
		// only got here if we didn't return false
		return true;
	}
}
