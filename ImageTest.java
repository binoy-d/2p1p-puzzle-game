import javax.swing.ImageIcon;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;

public class ImageTest {

  public static void main(String[] args) {
    JPanel panel = new JPanel();
    ImageLabel label = new ImageLabel(new ImageIcon("./images/wall.png"));
    label.setLocation(29, 37);
    panel.add(label);

    JFrame frame = new JFrame();
    frame.getContentPane().add(panel);
    frame.pack();
    frame.setVisible(true);
  }
}
