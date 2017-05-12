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

public class Player extends Point{
    Game parentGame;
  String[][] currentMap;
  public Player(int x, int y,Game g){
   super(x,y);
   parentGame = g;
   currentMap = parentGame.getCurrentMap();
  }
  public void checkEnemyTouch(){
    for(Enemy e: parentGame.getEnemies()){
      if(x == e.x && y == e.y){
       parentGame.initialize(); 
      }
    }
  }
  public static boolean isInteger(String s) {
    try { 
      Integer.parseInt(s); 
    } catch(NumberFormatException e) { 
      return false; 
    } catch(NullPointerException e) {
      return false;
    }
    // only got here if we didn't return false
    return true;
  }
  public void move(int vx,int vy){
   try{
        String val = currentMap[y+vy][x+vx];
        if((" P 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18").indexOf(val) != -1){//I die a little every time          
          x += vx;
          y += vy;

        }
        else if(val.equals("!")){
          parentGame.setPlayersDone(parentGame.getPlayersDone()+1);
          parentGame.getPlayers().remove(parentGame.getPlayers().indexOf(this));
          if(parentGame.getPlayersDone() >= parentGame.getTotalPlayers()){
            parentGame.setLevel(parentGame.getLevel()+1);
            parentGame.initialize();
          }
        }
        else if(val.equals("x")){
          parentGame.initialize();
        }
        for(Enemy e:parentGame.getEnemies()){
          if(x == e.x && e.y == y)
            parentGame.initialize();
        }
      }
      catch(Exception e){
        parentGame.getPlayers().remove(parentGame.getPlayers().indexOf(this));
      } 
  }
}